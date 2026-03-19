<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import { useEventStore } from '@/stores/event.store'
import { useQRScanner } from '@/composables/useQRScanner'
import type { Tables } from '@/types/database.types'

type AttendanceLog = Tables<'tbl_attendance_logs'>

const auth = useAuthStore()
const admin = useAdminStore()
const eventStore = useEventStore()

const activeTab = ref<'event' | 'member' | 'manual' | 'qr'>('event')
const logs = ref<AttendanceLog[]>([])
const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Manual check-in form
const manualForm = ref({
    user_id: '',
    event_id: null as number | null,
})
const manualSaving = ref(false)

// QR scanner
const { scannedToken, scanning, error: scanError, start: startScanner, stop: stopScanner, reset: resetScanner } = useQRScanner('qr-reader')
const qrEventId = ref<number | null>(null)
const qrProcessing = ref(false)

onMounted(async () => {
    await Promise.all([fetchLogs(), admin.fetchMembers(), eventStore.fetchEvents()])
    loading.value = false
})

async function fetchLogs() {
    let query = supabase
        .from('tbl_attendance_logs')
        .select('*')
        .order('log_date', { ascending: false })
        .limit(200)

    const churchScope = admin.getChurchScope()
    if (churchScope) {
        query = query.eq('logged_location_id', churchScope)
    }

    const { data } = await query
    logs.value = data ?? []
}

const filtered = computed(() => {
    const q = search.value.toLowerCase()
    let list = logs.value

    if (activeTab.value === 'member') {
        // Group view — no additional filter
    }

    if (q) {
        list = list.filter(
            (l) =>
                l.event_title?.toLowerCase().includes(q) ||
                l.logged_by_name?.toLowerCase().includes(q) ||
                l.logged_location_name?.toLowerCase().includes(q),
        )
    }
    return list
})

async function handleManualCheckIn() {
    if (!manualForm.value.user_id || !manualForm.value.event_id) return
    manualSaving.value = true
    message.value = null

    const event = eventStore.events.find((e) => e.id === manualForm.value.event_id)
    const member = admin.members.find((m) => m.user_id === manualForm.value.user_id)
    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    const { error } = await supabase.from('tbl_attendance_logs').insert({
        user_id: manualForm.value.user_id,
        event_id: manualForm.value.event_id,
        event_title: event?.event_title ?? null,
        input_method: 'manual',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${member?.first_name} ${member?.last_name} checked in.` }
        manualForm.value = { user_id: '', event_id: null }
        await fetchLogs()
    }
    manualSaving.value = false
}

// QR scan handler — watch scannedToken
async function handleQRScan() {
    if (!scannedToken.value || !qrEventId.value) return
    qrProcessing.value = true
    message.value = null

    // Find member by qr_token
    const { data: profile } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name')
        .eq('qr_token', scannedToken.value)
        .maybeSingle()

    if (!profile) {
        message.value = { type: 'error', text: 'QR code not recognized.' }
        qrProcessing.value = false
        resetScanner()
        return
    }

    const event = eventStore.events.find((e) => e.id === qrEventId.value)
    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    const { error } = await supabase.from('tbl_attendance_logs').insert({
        user_id: profile.user_id,
        event_id: qrEventId.value!,
        event_title: event?.event_title ?? null,
        input_method: 'QR',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${profile.first_name} ${profile.last_name} scanned in!` }
        await fetchLogs()
    }
    qrProcessing.value = false
    resetScanner()
}

// Watch for QR scan result
import { watch } from 'vue'
watch(scannedToken, (val) => {
    if (val) handleQRScan()
})

async function onTabChange(tab: typeof activeTab.value) {
    activeTab.value = tab
    if (tab === 'qr') {
        await nextTick()
        // Scanner started manually by user
    } else {
        stopScanner()
    }
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
    <div>
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Attendance Management</h1>

        <!-- Tabs -->
        <div class="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
            <button
                v-for="tab in [
                    { key: 'event' as const, label: 'By Event' },
                    { key: 'member' as const, label: 'By Member' },
                    { key: 'manual' as const, label: 'Manual Check-In' },
                    { key: 'qr' as const, label: 'QR Scanner' },
                ]"
                :key="tab.key"
                class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="onTabChange(tab.key)"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <!-- Manual Check-In Tab -->
        <div v-if="activeTab === 'manual'" class="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
            <h2 class="font-heading font-semibold text-navy mb-4">Manual Check-In</h2>
            <form @submit.prevent="handleManualCheckIn" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                    <select
                        v-model="manualForm.user_id"
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
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
                    <select
                        v-model="manualForm.event_id"
                        required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                    >
                        <option :value="null" disabled>Select event</option>
                        <option v-for="e in eventStore.events.filter(e => e.is_active)" :key="e.id" :value="e.id">
                            {{ e.event_title }}
                        </option>
                    </select>
                </div>
                <button
                    type="submit"
                    :disabled="manualSaving"
                    class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                >
                    {{ manualSaving ? 'Checking in...' : 'Check In' }}
                </button>
            </form>
        </div>

        <!-- QR Scanner Tab -->
        <div v-else-if="activeTab === 'qr'" class="max-w-lg">
            <div class="bg-white rounded-xl border border-gray-200 p-6">
                <h2 class="font-heading font-semibold text-navy mb-4">QR Code Scanner</h2>

                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
                    <select
                        v-model="qrEventId"
                        required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                    >
                        <option :value="null" disabled>Select event first</option>
                        <option v-for="e in eventStore.events.filter(e => e.is_active)" :key="e.id" :value="e.id">
                            {{ e.event_title }}
                        </option>
                    </select>
                </div>

                <div id="qr-reader" class="w-full mb-4 rounded-lg overflow-hidden" />

                <div class="flex gap-3">
                    <button
                        v-if="!scanning"
                        :disabled="!qrEventId"
                        class="flex-1 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                        @click="startScanner"
                    >
                        Start Scanning
                    </button>
                    <button
                        v-else
                        class="flex-1 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                        @click="stopScanner"
                    >
                        Stop
                    </button>
                </div>

                <p v-if="scanError" class="text-sm text-red-600 mt-3">{{ scanError }}</p>
                <p v-if="qrProcessing" class="text-sm text-navy mt-3">Processing scan...</p>
            </div>
        </div>

        <!-- Event / Member attendance logs -->
        <template v-else>
            <div class="mb-4">
                <input
                    v-model="search"
                    type="text"
                    placeholder="Search by event, name, or location..."
                    class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                />
            </div>

            <div v-if="loading" class="space-y-3">
                <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No attendance records.</div>

            <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Event</th>
                                <th class="px-4 py-3 hidden md:table-cell">Logged By</th>
                                <th class="px-4 py-3 hidden md:table-cell">Location</th>
                                <th class="px-4 py-3">Method</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Time</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="log in filtered" :key="log.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 text-gray-900">{{ formatDate(log.log_date) }}</td>
                                <td class="px-4 py-3 font-medium text-gray-900">{{ log.event_title ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_by_name ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_location_name ?? '—' }}</td>
                                <td class="px-4 py-3">
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
                                </td>
                                <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{{ formatTime(log.logged_at) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>
