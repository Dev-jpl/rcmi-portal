<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import { useQRScanner } from '@/composables/useQRScanner'
import type { Tables } from '@/types/database.types'

type Event = Tables<'tbl_events'>
type AttendanceLog = Tables<'tbl_attendance_logs'>

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const admin = useAdminStore()

const event = ref<Event | null>(null)
const loading = ref(true)
const rsvpTab = ref<'going' | 'maybe' | 'not_going'>('going')
const uploading = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

interface RsvpEntry {
    id: string
    user_id: string
    status: 'going' | 'maybe' | 'not_going'
    created_at: string
    first_name?: string
    last_name?: string
    email?: string
}

const allRsvps = ref<RsvpEntry[]>([])

// Attendance
const attendanceLogs = ref<AttendanceLog[]>([])
const attendanceTab = ref<'logs' | 'manual' | 'qr'>('logs')
const manualUserId = ref('')
const manualSaving = ref(false)
const attendanceMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const { scannedToken, scanning, error: scanError, start: startScanner, stop: stopScanner, reset: resetScanner } = useQRScanner('event-qr-reader')
const qrProcessing = ref(false)

onMounted(async () => {
    await Promise.all([fetchEvent(), fetchRsvps(), fetchAttendance(), admin.fetchMembers()])
    loading.value = false
})

async function fetchEvent() {
    const id = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_events')
        .select('*')
        .eq('id', id)
        .single()
    event.value = data
}

async function fetchRsvps() {
    const eventId = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_event_rsvps')
        .select('id, user_id, status, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

    if (!data) return

    const userIds = data.map((r: any) => r.user_id)
    if (!userIds.length) {
        allRsvps.value = []
        return
    }

    const { data: profiles } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds)

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
    )

    allRsvps.value = data.map((r: any) => {
        const profile = profileMap.get(r.user_id)
        return {
            ...r,
            first_name: profile?.first_name ?? '',
            last_name: profile?.last_name ?? '',
            email: profile?.email ?? '',
        }
    })
}

async function handleCoverUpload(e: globalThis.Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !event.value) return

    uploading.value = true
    message.value = null

    const ext = file.name.split('.').pop()
    const path = `events/${event.value.id}-${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
        .from('event-covers')
        .upload(path, file, { upsert: true })

    if (uploadErr) {
        message.value = { type: 'error', text: `Upload failed: ${uploadErr.message}` }
        uploading.value = false
        return
    }

    const { data: urlData } = supabase.storage
        .from('event-covers')
        .getPublicUrl(path)

    const { error: updateErr } = await supabase
        .from('tbl_events')
        .update({ cover_photo_url: urlData.publicUrl })
        .eq('id', event.value.id)

    if (updateErr) {
        message.value = { type: 'error', text: `Failed to save: ${updateErr.message}` }
    } else {
        (event.value as any).cover_photo_url = urlData.publicUrl
        message.value = { type: 'success', text: 'Cover photo updated!' }
    }

    uploading.value = false
}

async function removeCover() {
    if (!event.value) return
    uploading.value = true

    await supabase
        .from('tbl_events')
        .update({ cover_photo_url: null })
        .eq('id', event.value.id)

    ;(event.value as any).cover_photo_url = null
    message.value = { type: 'success', text: 'Cover photo removed.' }
    uploading.value = false
}

// Attendance functions
async function fetchAttendance() {
    const eventId = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_attendance_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('logged_at', { ascending: false })
    attendanceLogs.value = data ?? []
}

async function handleManualCheckIn() {
    if (!manualUserId.value || !event.value) return
    manualSaving.value = true
    attendanceMessage.value = null

    const member = admin.members.find(m => m.user_id === manualUserId.value)
    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    const { error } = await supabase.from('tbl_attendance_logs').insert({
        user_id: manualUserId.value,
        event_id: event.value.id,
        event_title: event.value.event_title,
        input_method: 'manual',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    })

    if (error) {
        attendanceMessage.value = { type: 'error', text: error.message }
    } else {
        attendanceMessage.value = { type: 'success', text: `${member?.first_name} ${member?.last_name} checked in.` }
        manualUserId.value = ''
        await fetchAttendance()
    }
    manualSaving.value = false
}

async function handleEventQRScan() {
    if (!scannedToken.value || !event.value) return
    qrProcessing.value = true
    attendanceMessage.value = null

    const { data: profile } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name')
        .eq('qr_token', scannedToken.value)
        .maybeSingle()

    if (!profile) {
        attendanceMessage.value = { type: 'error', text: 'QR code not recognized.' }
        qrProcessing.value = false
        resetScanner()
        return
    }

    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    const { error } = await supabase.from('tbl_attendance_logs').insert({
        user_id: profile.user_id,
        event_id: event.value.id,
        event_title: event.value.event_title,
        input_method: 'QR',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    })

    if (error) {
        attendanceMessage.value = { type: 'error', text: error.message }
    } else {
        attendanceMessage.value = { type: 'success', text: `${profile.first_name} ${profile.last_name} scanned in!` }
        await fetchAttendance()
    }
    qrProcessing.value = false
    resetScanner()
}

watch(scannedToken, (val) => {
    if (val) handleEventQRScan()
})

async function onAttendanceTabChange(tab: typeof attendanceTab.value) {
    attendanceTab.value = tab
    if (tab === 'qr') {
        await nextTick()
    } else {
        stopScanner()
    }
}

const goingList = computed(() => allRsvps.value.filter((r) => r.status === 'going'))
const maybeList = computed(() => allRsvps.value.filter((r) => r.status === 'maybe'))
const notGoingList = computed(() => allRsvps.value.filter((r) => r.status === 'not_going'))

const activeList = computed(() => {
    switch (rsvpTab.value) {
        case 'going': return goingList.value
        case 'maybe': return maybeList.value
        case 'not_going': return notGoingList.value
    }
})

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function formatFullDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(first: string, last: string) {
    return (first?.[0] ?? '') + (last?.[0] ?? '')
}
</script>

<template>
    <div class="max-w-5xl mx-auto">
        <!-- Back -->
        <button
            class="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy font-medium mb-6 transition-colors"
            @click="router.push({ name: 'admin-events' })"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Events
        </button>

        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-64 bg-gray-200 rounded-2xl animate-pulse" />
            <div class="h-8 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>

        <template v-else-if="event">
            <!-- Message -->
            <p
                v-if="message"
                class="text-sm rounded-xl px-4 py-3 mb-4"
                :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
            >
                {{ message.text }}
            </p>

            <!-- Cover Photo with Upload -->
            <div class="relative rounded-2xl overflow-hidden mb-6 group/cover">
                <div class="h-56 sm:h-72 bg-gradient-to-br from-navy/10 to-navy/5">
                    <img
                        v-if="(event as any).cover_photo_url"
                        :src="(event as any).cover_photo_url"
                        :alt="event.event_title"
                        class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex flex-col items-center justify-center gap-2">
                        <svg class="w-12 h-12 text-navy/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                        <p class="text-xs text-navy/20 font-medium">No cover photo</p>
                    </div>
                </div>
                <!-- Upload overlay -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                    <label
                        class="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl text-sm font-semibold text-navy cursor-pointer hover:bg-gray-50 transition-colors shadow-lg"
                        :class="{ 'opacity-50 pointer-events-none': uploading }"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        {{ uploading ? 'Uploading...' : 'Upload Cover' }}
                        <input type="file" accept="image/*" class="hidden" @change="handleCoverUpload" />
                    </label>
                    <button
                        v-if="(event as any).cover_photo_url"
                        class="flex items-center gap-2 px-4 py-2.5 bg-red-500 rounded-xl text-sm font-semibold text-white hover:bg-red-600 transition-colors shadow-lg"
                        :disabled="uploading"
                        @click="removeCover"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Remove
                    </button>
                </div>
                <!-- Status + type badges -->
                <div class="absolute top-4 left-4 flex items-center gap-2">
                    <span
                        class="text-xs font-semibold px-3 py-1.5 rounded-lg backdrop-blur-sm"
                        :class="event.is_active ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white'"
                    >
                        {{ event.is_active ? 'Active' : 'Inactive' }}
                    </span>
                </div>
                <div v-if="event.event_type" class="absolute top-4 right-4 bg-navy/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                    {{ event.event_type }}
                </div>
            </div>

            <div class="grid lg:grid-cols-3 gap-6">
                <!-- Left: Event Details -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Event Info -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                        <h1 class="text-2xl sm:text-3xl font-heading font-bold text-navy mb-5">{{ event.event_title }}</h1>

                        <div class="grid sm:grid-cols-2 gap-4 mb-6">
                            <div class="flex items-start gap-3.5">
                                <div class="w-10 h-10 rounded-xl bg-navy/6 flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Date & Time</p>
                                    <p class="text-sm font-semibold text-gray-900">{{ formatDate(event.duration_from) }}</p>
                                    <p class="text-xs text-gray-500 mt-0.5">
                                        {{ formatTime(event.duration_from) }}
                                        <template v-if="event.duration_to"> — {{ formatTime(event.duration_to) }}</template>
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-start gap-3.5">
                                <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Responses</p>
                                    <p class="text-sm font-semibold text-gray-900">{{ allRsvps.length }} total</p>
                                    <p class="text-xs text-gray-500 mt-0.5">{{ goingList.length }} going &middot; {{ maybeList.length }} maybe &middot; {{ notGoingList.length }} can't go</p>
                                </div>
                            </div>
                        </div>

                        <div v-if="event.remarks" class="pt-5 border-t border-gray-100">
                            <h3 class="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                            <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ event.remarks }}</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-5 border-t border-gray-100 mt-5">
                            <span v-if="event.created_by_name">Created by {{ event.created_by_name }}</span>
                            <span v-if="event.created_at">&middot; {{ formatFullDate(event.created_at) }}</span>
                        </div>
                    </div>

                    <!-- Attendance Section -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                        <h2 class="font-heading font-semibold text-navy text-lg mb-5">
                            Attendance
                            <span class="text-sm font-normal text-gray-400 ml-2">{{ attendanceLogs.length }} logged</span>
                        </h2>

                        <!-- Attendance tabs -->
                        <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
                            <button
                                v-for="tab in [
                                    { key: 'logs' as const, label: 'Logs' },
                                    { key: 'manual' as const, label: 'Manual Check-In' },
                                    { key: 'qr' as const, label: 'QR Scan' },
                                ]"
                                :key="tab.key"
                                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                                :class="attendanceTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                                @click="onAttendanceTabChange(tab.key)"
                            >
                                {{ tab.label }}
                            </button>
                        </div>

                        <!-- Attendance message -->
                        <p
                            v-if="attendanceMessage"
                            class="text-sm rounded-lg px-4 py-2 mb-4"
                            :class="attendanceMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
                        >
                            {{ attendanceMessage.text }}
                        </p>

                        <!-- Logs tab -->
                        <div v-if="attendanceTab === 'logs'">
                            <div v-if="!attendanceLogs.length" class="text-center py-8 text-gray-400 text-sm">No attendance logged yet.</div>
                            <div v-else class="space-y-1 max-h-96 overflow-y-auto">
                                <div
                                    v-for="log in attendanceLogs"
                                    :key="log.id"
                                    class="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-navy/6 flex items-center justify-center text-xs font-bold text-navy/50 shrink-0">
                                            {{ (log.logged_by_name ?? '?')[0] }}
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-gray-900">{{ log.logged_by_name ?? '—' }}</p>
                                            <p class="text-xs text-gray-400">{{ formatTime(log.logged_at) }}</p>
                                        </div>
                                    </div>
                                    <span
                                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="{
                                            'bg-blue-100 text-blue-700': log.input_method === 'QR',
                                            'bg-green-100 text-green-700': log.input_method === 'self',
                                            'bg-gray-100 text-gray-600': log.input_method === 'manual',
                                        }"
                                    >
                                        {{ log.input_method }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Manual check-in tab -->
                        <div v-else-if="attendanceTab === 'manual'">
                            <form @submit.prevent="handleManualCheckIn" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                                    <select
                                        v-model="manualUserId"
                                        required
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    >
                                        <option value="" disabled>Select member</option>
                                        <option
                                            v-for="m in admin.members.filter(m => m.status === 'approved')"
                                            :key="m.user_id"
                                            :value="m.user_id"
                                        >
                                            {{ m.first_name }} {{ m.last_name }}
                                        </option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    :disabled="manualSaving || !manualUserId"
                                    class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors text-sm"
                                >
                                    {{ manualSaving ? 'Checking in...' : 'Check In' }}
                                </button>
                            </form>
                        </div>

                        <!-- QR scan tab -->
                        <div v-else-if="attendanceTab === 'qr'">
                            <div id="event-qr-reader" class="w-full mb-4 rounded-lg overflow-hidden" />
                            <div class="flex gap-3">
                                <button
                                    v-if="!scanning"
                                    class="flex-1 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 transition-colors text-sm"
                                    @click="startScanner"
                                >
                                    Start Scanning
                                </button>
                                <button
                                    v-else
                                    class="flex-1 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors text-sm"
                                    @click="stopScanner"
                                >
                                    Stop
                                </button>
                            </div>
                            <p v-if="scanError" class="text-sm text-red-600 mt-3">{{ scanError }}</p>
                            <p v-if="qrProcessing" class="text-sm text-navy mt-3">Processing scan...</p>
                        </div>
                    </div>

                    <!-- RSVP Lists -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                        <h2 class="font-heading font-semibold text-navy text-lg mb-5">RSVP Attendees</h2>

                        <div class="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 mb-5">
                            <button
                                class="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                :class="rsvpTab === 'going' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="rsvpTab = 'going'"
                            >
                                <span class="hidden sm:inline">Going</span> ({{ goingList.length }})
                            </button>
                            <button
                                class="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                :class="rsvpTab === 'maybe' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="rsvpTab = 'maybe'"
                            >
                                <span class="hidden sm:inline">Maybe</span> ({{ maybeList.length }})
                            </button>
                            <button
                                class="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                :class="rsvpTab === 'not_going' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="rsvpTab = 'not_going'"
                            >
                                <span class="hidden sm:inline">Can't Go</span> ({{ notGoingList.length }})
                            </button>
                        </div>

                        <div v-if="!activeList.length" class="text-center py-10 text-gray-400 text-sm">
                            No responses in this category
                        </div>
                        <div v-else class="space-y-1">
                            <div
                                v-for="person in activeList"
                                :key="person.id"
                                class="flex items-center gap-3.5 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                <div class="w-10 h-10 rounded-xl bg-navy/6 flex items-center justify-center text-sm font-bold text-navy/50 shrink-0">
                                    {{ getInitials(person.first_name ?? '', person.last_name ?? '') }}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-sm font-medium text-gray-900 truncate">
                                        {{ person.first_name }} {{ person.last_name }}
                                    </p>
                                    <p class="text-xs text-gray-400 truncate">{{ person.email }}</p>
                                </div>
                                <span
                                    class="text-[11px] font-medium px-2.5 py-1 rounded-lg shrink-0"
                                    :class="{
                                        'bg-green-50 text-green-600': person.status === 'going',
                                        'bg-amber-50 text-amber-600': person.status === 'maybe',
                                        'bg-red-50 text-red-500': person.status === 'not_going',
                                    }"
                                >
                                    {{ person.status === 'not_going' ? "Can't Go" : person.status === 'going' ? 'Going' : 'Maybe' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right sidebar: Quick Stats -->
                <div class="space-y-6">
                    <!-- Summary Card -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 class="font-heading font-semibold text-navy mb-4">Quick Stats</h3>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span class="text-sm text-gray-600">Going</span>
                                </div>
                                <span class="text-lg font-heading font-bold text-green-600">{{ goingList.length }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                                        </svg>
                                    </div>
                                    <span class="text-sm text-gray-600">Maybe</span>
                                </div>
                                <span class="text-lg font-heading font-bold text-amber-600">{{ maybeList.length }}</span>
                            </div>
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <span class="text-sm text-gray-600">Can't Go</span>
                                </div>
                                <span class="text-lg font-heading font-bold text-red-500">{{ notGoingList.length }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Event Meta -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 class="font-heading font-semibold text-navy mb-4">Details</h3>
                        <div class="space-y-3">
                            <div>
                                <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Status</p>
                                <span
                                    class="inline-flex text-xs font-medium px-2.5 py-1 rounded-lg mt-1"
                                    :class="event.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'"
                                >
                                    {{ event.is_active ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                            <div v-if="event.event_type">
                                <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Type</p>
                                <p class="text-sm text-gray-900 mt-0.5">{{ event.event_type }}</p>
                            </div>
                            <div v-if="event.created_by_name">
                                <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Created By</p>
                                <p class="text-sm text-gray-900 mt-0.5">{{ event.created_by_name }}</p>
                            </div>
                            <div>
                                <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Created</p>
                                <p class="text-sm text-gray-900 mt-0.5">{{ formatFullDate(event.created_at) }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <div v-else class="text-center py-16 text-gray-400">
            <p class="text-sm">Event not found</p>
        </div>
    </div>
</template>
