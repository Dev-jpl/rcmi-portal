<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import { useEventStore } from '@/stores/event.store'
import { useQRScanner } from '@/composables/useQRScanner'

const auth = useAuthStore()
const admin = useAdminStore()
const eventStore = useEventStore()

const activeTab = ref<'event' | 'member' | 'manual' | 'qr'>('event')
const logs = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Manual check-in form
const manualLogType = ref<'event' | 'program'>('event')
const manualForm = ref({
    user_id: '',
    event_id: null as number | null,
    program_id: null as number | null,
})
const manualSaving = ref(false)

// QR scanner
const { scannedToken, scanning, error: scanError, start: startScanner, stop: stopScanner, reset: resetScanner } = useQRScanner('qr-reader')
const qrLogType = ref<'event' | 'program'>('event')
const qrEventId = ref<number | null>(null)
const qrProgramId = ref<number | null>(null)
const qrProcessing = ref(false)

// Default events from library
const defaultEvents = ref<{ id: number; event_title: string }[]>([])
// Programs from library
const programs = ref<{ id: number; type: string }[]>([])

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

// Merged list: real events + default events (with negative IDs to distinguish)
const allEventOptions = computed(() => {
    const real = eventStore.events
        .filter(e => e.is_active)
        .map(e => ({ id: e.id, label: e.event_title, isDefault: false }))
    const defaults = defaultEvents.value
        .map(d => ({ id: -d.id, label: `${d.event_title} (Default)`, isDefault: true }))
    return [...real, ...defaults]
})

// Resolve the real event title for logging (strip " (Default)" suffix)
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

onMounted(async () => {
    await Promise.all([fetchLogs(), admin.fetchMembers(), eventStore.fetchEvents(), fetchDefaultEvents(), fetchPrograms()])
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

    if (q) {
        list = list.filter(
            (l: any) =>
                l.event_title?.toLowerCase().includes(q) ||
                l.logged_by_name?.toLowerCase().includes(q) ||
                l.logged_location_name?.toLowerCase().includes(q) ||
                getMemberName(l.user_id).toLowerCase().includes(q) ||
                getLogTitle(l).toLowerCase().includes(q),
        )
    }
    return list
})

function buildLogPayload(userId: string, logType: 'event' | 'program', eventId: number | null, programId: number | null, inputMethod: string) {
    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    if (logType === 'program') {
        const programName = getProgramName(programId)
        return {
            user_id: userId,
            log_type: 'program',
            event_id: null,
            event_title: programName,
            program_id: programId,
            input_method: inputMethod,
            log_date: new Date().toISOString().split('T')[0],
            logged_at: new Date().toISOString(),
            logged_by: auth.session?.user.id ?? null,
            logged_by_name: userName,
            logged_location_id: auth.profile?.satellite_church_id ?? null,
            logged_location_name: auth.profile?.satellite_church_name ?? null,
        }
    }

    // Event
    const eventTitle = getEventTitleForLog(eventId)
    const realEventId = eventId && eventId > 0 ? eventId : null
    return {
        user_id: userId,
        log_type: 'event',
        event_id: realEventId,
        event_title: eventTitle,
        program_id: null,
        input_method: inputMethod,
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session?.user.id ?? null,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
    }
}

async function handleManualCheckIn() {
    if (!manualForm.value.user_id) return
    if (manualLogType.value === 'event' && !manualForm.value.event_id) return
    if (manualLogType.value === 'program' && !manualForm.value.program_id) return
    manualSaving.value = true
    message.value = null

    const member = admin.members.find((m: any) => m.user_id === manualForm.value.user_id)
    const payload = buildLogPayload(
        manualForm.value.user_id,
        manualLogType.value,
        manualForm.value.event_id,
        manualForm.value.program_id,
        'manual',
    )

    const { error } = await supabase.from('tbl_attendance_logs').insert(payload)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${member?.first_name} ${member?.last_name} checked in.` }
        manualForm.value = { user_id: '', event_id: null, program_id: null }
        await fetchLogs()
    }
    manualSaving.value = false
}

// QR scan handler
async function handleQRScan() {
    if (!scannedToken.value) return
    if (qrLogType.value === 'event' && !qrEventId.value) return
    if (qrLogType.value === 'program' && !qrProgramId.value) return
    qrProcessing.value = true
    message.value = null

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

    const payload = buildLogPayload(
        profile.user_id,
        qrLogType.value,
        qrEventId.value,
        qrProgramId.value,
        'QR',
    )

    const { error } = await supabase.from('tbl_attendance_logs').insert(payload)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${profile.first_name} ${profile.last_name} scanned in!` }
        await fetchLogs()
    }
    qrProcessing.value = false
    resetScanner()
}

watch(scannedToken, (val) => {
    if (val) handleQRScan()
})

async function onTabChange(tab: typeof activeTab.value) {
    activeTab.value = tab
    if (tab === 'qr') {
        await nextTick()
    } else {
        stopScanner()
    }
}

function getMemberName(userId: string | null) {
    if (!userId) return '—'
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function getLogTitle(log: any) {
    return log.event_title ?? '—'
}

function getLogTypeBadge(log: any) {
    return log.log_type === 'program' ? 'Program' : 'Event'
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
        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-6 flex-wrap">
            <button v-for="tab in [
                { key: 'event' as const, label: 'By Event' },
                { key: 'member' as const, label: 'By Member' },
                { key: 'manual' as const, label: 'Manual Check-In' },
                { key: 'qr' as const, label: 'QR Scanner' },
            ]" :key="tab.key" class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="onTabChange(tab.key)">
                {{ tab.label }}
            </button>
        </div>

        <!-- Message -->
        <p v-if="message" class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
            {{ message.text }}
        </p>

        <!-- Manual Check-In Tab -->
        <div v-if="activeTab === 'manual'" class="bg-white rounded-lg border border-gray-200 p-6 max-w-lg">
            <h2 class="font-heading font-semibold text-navy mb-4">Manual Check-In</h2>
            <form @submit.prevent="handleManualCheckIn" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                    <select v-model="manualForm.user_id" required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                        <option value="" disabled>Select member</option>
                        <option v-for="m in admin.members.filter(m => m.status === 'approved')" :key="m.user_id"
                            :value="m.user_id">
                            {{ m.first_name }} {{ m.last_name }}
                        </option>
                    </select>
                </div>

                <!-- Log Type Toggle -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Log For</label>
                    <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                        <button type="button" class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                            :class="manualLogType === 'event' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                            @click="manualLogType = 'event'">
                            Event
                        </button>
                        <button type="button" class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                            :class="manualLogType === 'program' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                            @click="manualLogType = 'program'">
                            Program
                        </button>
                    </div>
                </div>

                <!-- Event Select -->
                <div v-if="manualLogType === 'event'">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
                    <select v-model="manualForm.event_id" required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                        <option :value="null" disabled>Select event</option>
                        <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
                            {{ opt.label }}
                        </option>
                    </select>
                </div>

                <!-- Program Select -->
                <div v-else>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
                    <select v-model="manualForm.program_id" required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                        <option :value="null" disabled>Select program</option>
                        <option v-for="p in programs" :key="p.id" :value="p.id">
                            {{ p.type }}
                        </option>
                    </select>
                </div>

                <button type="submit" :disabled="manualSaving"
                    class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors">
                    {{ manualSaving ? 'Checking in...' : 'Check In' }}
                </button>
            </form>
        </div>

        <!-- QR Scanner Tab -->
        <div v-else-if="activeTab === 'qr'" class="max-w-lg">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
                <h2 class="font-heading font-semibold text-navy mb-4">QR Code Scanner</h2>

                <!-- Log Type Toggle -->
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Log For</label>
                    <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                        <button type="button" class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                            :class="qrLogType === 'event' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                            @click="qrLogType = 'event'">
                            Event
                        </button>
                        <button type="button" class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                            :class="qrLogType === 'program' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                            @click="qrLogType = 'program'">
                            Program
                        </button>
                    </div>
                </div>

                <!-- Event Select -->
                <div v-if="qrLogType === 'event'" class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
                    <select v-model="qrEventId" required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                        <option :value="null" disabled>Select event first</option>
                        <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
                            {{ opt.label }}
                        </option>
                    </select>
                </div>

                <!-- Program Select -->
                <div v-else class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
                    <select v-model="qrProgramId" required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                        <option :value="null" disabled>Select program first</option>
                        <option v-for="p in programs" :key="p.id" :value="p.id">
                            {{ p.type }}
                        </option>
                    </select>
                </div>

                <div id="qr-reader" class="w-full mb-4 rounded-lg overflow-hidden" />

                <div class="flex gap-3">
                    <button v-if="!scanning"
                        :disabled="(qrLogType === 'event' && !qrEventId) || (qrLogType === 'program' && !qrProgramId)"
                        class="flex-1 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                        @click="startScanner">
                        Start Scanning
                    </button>
                    <button v-else
                        class="flex-1 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                        @click="stopScanner">
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
                <input v-model="search" type="text" placeholder="Search by event, program, name, or location..."
                    class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
            </div>

            <div v-if="loading" class="space-y-3">
                <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No attendance records.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Member</th>
                                <th class="px-4 py-3">Type</th>
                                <th class="px-4 py-3">Event / Program</th>
                                <th class="px-4 py-3 hidden md:table-cell">Logged By</th>
                                <th class="px-4 py-3 hidden md:table-cell">Location</th>
                                <th class="px-4 py-3">Method</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Time</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="log in filtered" :key="log.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 text-gray-900">{{ formatDate(log.log_date) }}</td>
                                <td class="px-4 py-3 font-medium text-gray-900">{{ getMemberName(log.user_id) }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="log.log_type === 'program' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'">
                                        {{ getLogTypeBadge(log) }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 font-medium text-gray-900">{{ getLogTitle(log) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_by_name ?? '—' }}
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_location_name ??
                                    '—' }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="{
                                        'bg-blue-100 text-blue-700': log.input_method === 'QR',
                                        'bg-green-100 text-green-700': log.input_method === 'self',
                                        'bg-gray-100 text-gray-600': log.input_method === 'manual',
                                    }">
                                        {{ log.input_method }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{{
                                    formatTime(log.logged_at) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>
