<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useEventStore } from '@/stores/event.store'
import { useQRScanner } from '@/composables/useQRScanner'

const auth = useAuthStore()
const eventStore = useEventStore()

const logType = ref<'event' | 'program'>('event')
const selectedEventId = ref<number | null>(null)
const selectedProgramId = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const processing = ref(false)
const recentScans = ref<{ name: string; title: string; time: string }[]>([])

const { scannedToken, scanning, error: scanError, start: startScanner, stop: stopScanner, reset: resetScanner } = useQRScanner('ministry-qr-reader')

// Default events
const defaultEvents = ref<{ id: number; event_title: string }[]>([])
// Programs
const programs = ref<{ id: number; type: string }[]>([])

const allEventOptions = computed(() => {
    const real = eventStore.events
        .filter(e => e.is_active)
        .map(e => ({ id: e.id, label: e.event_title }))
    const defaults = defaultEvents.value
        .map(d => ({ id: -d.id, label: `${d.event_title} (Default)` }))
    return [...real, ...defaults]
})

onMounted(async () => {
    await Promise.all([
        eventStore.fetchEvents(),
        fetchDefaultEvents(),
        fetchPrograms(),
    ])
})

onUnmounted(() => {
    stopScanner()
})

async function fetchDefaultEvents() {
    const { data } = await supabase
        .from('lib_default_events')
        .select('id, event_title')
        .eq('is_active', true)
        .order('event_title')
    defaultEvents.value = data ?? []
}

async function fetchPrograms() {
    const { data } = await supabase
        .from('lib_programs')
        .select('id, type')
        .eq('is_active', true)
        .order('type')
    programs.value = data ?? []
}

function getEventTitleForLog(id: number | null) {
    if (!id) return null
    if (id > 0) {
        const evt = eventStore.events.find(e => e.id === id)
        return evt?.event_title ?? null
    }
    const de = defaultEvents.value.find(d => d.id === -id!)
    return de?.event_title ?? null
}

function getProgramName(id: number | null) {
    if (!id) return null
    return programs.value.find(p => p.id === id)?.type ?? null
}

const canStartScan = computed(() => {
    if (logType.value === 'event') return !!selectedEventId.value
    return !!selectedProgramId.value
})

watch(scannedToken, (val) => {
    if (val) handleScan()
})

async function handleScan() {
    if (!scannedToken.value) return
    if (logType.value === 'event' && !selectedEventId.value) return
    if (logType.value === 'program' && !selectedProgramId.value) return
    processing.value = true
    message.value = null

    const { data: profile } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name')
        .eq('qr_token', scannedToken.value)
        .maybeSingle()

    if (!profile) {
        message.value = { type: 'error', text: 'QR code not recognized.' }
        processing.value = false
        resetScanner()
        return
    }

    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()
    let title: string | null = null

    const payload: Record<string, unknown> = {
        user_id: profile.user_id,
        input_method: 'QR',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    }

    if (logType.value === 'program') {
        title = getProgramName(selectedProgramId.value)
        payload.log_type = 'program'
        payload.program_id = selectedProgramId.value
        payload.event_id = null
        payload.event_title = title
    } else {
        title = getEventTitleForLog(selectedEventId.value)
        const realEventId = selectedEventId.value && selectedEventId.value > 0 ? selectedEventId.value : null
        payload.log_type = 'event'
        payload.event_id = realEventId
        payload.event_title = title
        payload.program_id = null
    }

    const { error } = await supabase.from('tbl_attendance_logs').insert(payload)

    const memberName = `${profile.first_name} ${profile.last_name}`
    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${memberName} checked in!` }
        recentScans.value.unshift({
            name: memberName,
            title: title ?? '—',
            time: new Date().toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' }),
        })
        if (recentScans.value.length > 10) recentScans.value.pop()
    }
    processing.value = false
    resetScanner()
}
</script>

<template>
    <div class="max-w-lg mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">QR Scan Check-In</h1>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <div class="bg-white rounded-lg border border-gray-200 p-6">
            <!-- Log Type Toggle -->
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Log For</label>
                <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                    <button
                        type="button"
                        class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                        :class="logType === 'event' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                        @click="logType = 'event'"
                    >
                        Event
                    </button>
                    <button
                        type="button"
                        class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                        :class="logType === 'program' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                        @click="logType = 'program'"
                    >
                        Program
                    </button>
                </div>
            </div>

            <!-- Event Select -->
            <div v-if="logType === 'event'" class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
                <select
                    v-model="selectedEventId"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                    <option :value="null" disabled>Select event</option>
                    <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
                        {{ opt.label }}
                    </option>
                </select>
            </div>

            <!-- Program Select -->
            <div v-else class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
                <select
                    v-model="selectedProgramId"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                    <option :value="null" disabled>Select program</option>
                    <option v-for="p in programs" :key="p.id" :value="p.id">
                        {{ p.type }}
                    </option>
                </select>
            </div>

            <!-- QR Reader -->
            <div id="ministry-qr-reader" class="w-full mb-4 rounded-lg overflow-hidden" />

            <div class="flex gap-3">
                <button
                    v-if="!scanning"
                    :disabled="!canStartScan"
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
            <p v-if="processing" class="text-sm text-navy mt-3">Processing scan...</p>
        </div>

        <!-- Recent Scans -->
        <div v-if="recentScans.length" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 mb-3">Recent Scans</h3>
            <div class="space-y-2">
                <div
                    v-for="(scan, i) in recentScans"
                    :key="i"
                    class="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between"
                >
                    <div>
                        <p class="text-sm font-medium text-gray-900">{{ scan.name }}</p>
                        <p class="text-xs text-gray-500">{{ scan.title }}</p>
                    </div>
                    <span class="text-xs text-gray-400">{{ scan.time }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
