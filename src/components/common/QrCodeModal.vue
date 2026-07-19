<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useEventStore } from '@/stores/event.store'
import { useQR } from '@/composables/useQR'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const eventStore = useEventStore()
const { qrDataUrl, loading } = useQR(() => auth.profile?.qr_token)

const activeTab = ref<'show' | 'scan'>('show')
const scanResult = ref<string | null>(null)
const scanError = ref<string | null>(null)
const scanSuccess = ref<{ name: string; title: string } | null>(null)
const scanning = ref(false)

// Scan config
const scanLogType = ref<'event' | 'program' | 'bible_study'>('event')
const scanEventId = ref<number | null>(null)
const scanProgramId = ref<number | null>(null)
const scanPastorId = ref<string | null>(null)
const scanBibleStudyId = ref<number | null>(null)

// Data
const defaultEvents = ref<{ id: number; event_title: string }[]>([])
const programs = ref<{ id: number; type: string }[]>([])
const pastors = ref<{ user_id: string; name: string }[]>([])
const bibleStudies = ref<{ id: number; title: string }[]>([])
// bible_study_id -> handler user_ids, used to narrow studies down to the
// selected pastor's own.
const bibleStudyHandlers = ref<Record<number, string[]>>({})

const allEventOptions = computed(() => {
    const real = eventStore.events
        .filter(e => e.is_active)
        .map(e => ({ id: e.id, label: e.event_title }))
    const defaults = defaultEvents.value
        .map(d => ({ id: -d.id, label: `${d.event_title} (Default)` }))
    return [...real, ...defaults]
})

// Studies led by the selected pastor. A pastor with no handler rows falls back
// to the full active list rather than showing an empty dropdown.
const bibleStudyOptions = computed(() => {
    if (!scanPastorId.value) return []
    const own = bibleStudies.value.filter(s =>
        (bibleStudyHandlers.value[s.id] ?? []).includes(scanPastorId.value!)
    )
    return own.length ? own : bibleStudies.value
})

// Always allow scanning — event QR codes work without pre-selection
const canStartScan = computed(() => true)

let scanner: Html5Qrcode | null = null
let dataLoaded = false

async function loadData() {
    if (dataLoaded) return
    await Promise.all([
        eventStore.fetchEvents(),
        fetchDefaultEvents(),
        fetchPrograms(),
        fetchBibleStudies(),
    ])
    dataLoaded = true
}

async function fetchBibleStudies() {
    const [{ data: studies }, { data: handlers }, { data: pastoral }] = await Promise.all([
        supabase
            .from('tbl_bible_studies')
            .select('id, title')
            .eq('is_active', true)
            .order('title'),
        supabase
            .from('tbl_bible_study_handlers')
            .select('bible_study_id, user_id'),
        supabase
            .from('tbl_pastoral_members')
            .select('user_id, user:tbl_users!tbl_pastoral_members_user_id_fkey(first_name, last_name)')
            .eq('is_active', 'Y'),
    ])

    bibleStudies.value = studies ?? []

    const map: Record<number, string[]> = {}
    for (const h of handlers ?? []) {
        ;(map[h.bible_study_id] ??= []).push(h.user_id)
    }
    bibleStudyHandlers.value = map

    pastors.value = (pastoral ?? [])
        .map((p: any) => ({
            user_id: p.user_id,
            name: `${p.user?.first_name ?? ''} ${p.user?.last_name ?? ''}`.trim() || 'Unnamed',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
}

function getBibleStudyTitle(id: number | null) {
    if (!id) return null
    return bibleStudies.value.find(s => s.id === id)?.title ?? null
}

function getPastorName(id: string | null) {
    if (!id) return null
    return pastors.value.find(p => p.user_id === id)?.name ?? null
}

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

async function startScanner() {
    scanResult.value = null
    scanError.value = null
    scanSuccess.value = null
    scanning.value = true

    await nextTick()
    const el = document.getElementById('qr-reader')
    if (!el) { scanning.value = false; return }

    try {
        scanner = new Html5Qrcode('qr-reader')
        await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => {}
        )
    } catch (e: any) {
        scanError.value = e?.message ?? 'Could not access camera'
        scanning.value = false
    }
}

async function stopScanner() {
    if (scanner) {
        try { await scanner.stop() } catch {}
        try { scanner.clear() } catch {}
        scanner = null
    }
    scanning.value = false
}

// The result panel only renders a message when scanSuccess or scanError is set,
// so anything thrown in between leaves a blank box. Always surface a reason.
async function onScanSuccess(decodedText: string) {
    try {
        await processScan(decodedText)
    } catch (e: any) {
        scanError.value = e?.message ?? 'Something went wrong while logging attendance'
    }
    if (!scanSuccess.value && !scanError.value) {
        scanError.value = 'Attendance was not logged — no reason reported'
    }
}

async function processScan(decodedText: string) {
    await stopScanner()
    scanResult.value = decodedText

    // Check if this is an Event QR code (format: "event:<id>")
    const eventQrMatch = decodedText.match(/^event:(\d+)$/)
    if (eventQrMatch) {
        await handleEventQrSelfCheckin(parseInt(eventQrMatch[1]))
        return
    }

    // Otherwise, it's a member QR token — look up member
    const { data: profile } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name')
        .eq('qr_token', decodedText)
        .maybeSingle()

    if (!profile) {
        scanError.value = 'Member not found for this QR code'
        return
    }

    // For member QR, require event/program selection
    if (scanLogType.value === 'event' && !scanEventId.value) {
        scanError.value = 'Please select an event first before scanning a member QR'
        return
    }
    if (scanLogType.value === 'program' && !scanProgramId.value) {
        scanError.value = 'Please select a program first before scanning a member QR'
        return
    }
    if (scanLogType.value === 'bible_study') {
        if (!scanPastorId.value) {
            scanError.value = 'Please select a pastor first before scanning a member QR'
            return
        }
        if (!scanBibleStudyId.value) {
            scanError.value = 'Please select a bible study first before scanning a member QR'
            return
        }
    }

    // Build attendance log
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

    if (scanLogType.value === 'bible_study') {
        title = getBibleStudyTitle(scanBibleStudyId.value)
        payload.log_type = 'bible_study'
        payload.bible_study_id = scanBibleStudyId.value
        payload.bs_pastor_id = scanPastorId.value
        payload.bs_pastor_name = getPastorName(scanPastorId.value)
        payload.event_id = null
        payload.event_title = title
        payload.program_id = null
    } else if (scanLogType.value === 'program') {
        title = getProgramName(scanProgramId.value)
        payload.log_type = 'program'
        payload.program_id = scanProgramId.value
        payload.event_id = null
        payload.event_title = title
    } else {
        title = getEventTitleForLog(scanEventId.value)
        const realEventId = scanEventId.value && scanEventId.value > 0 ? scanEventId.value : null
        payload.log_type = 'event'
        payload.event_id = realEventId
        payload.event_title = title
        payload.program_id = null
    }

    const { error } = await supabase.from('tbl_attendance_logs').insert(payload)

    const memberName = `${profile.first_name} ${profile.last_name}`
    if (error) {
        scanError.value = error.message
    } else {
        scanSuccess.value = { name: memberName, title: title ?? '—' }
    }
}

// Self check-in when scanning an Event QR code
async function handleEventQrSelfCheckin(eventId: number) {
    if (!auth.session?.user) {
        scanError.value = 'You must be logged in to check in'
        return
    }

    // Look up the event title
    const { data: evt } = await supabase
        .from('tbl_events')
        .select('id, event_title')
        .eq('id', eventId)
        .maybeSingle()

    if (!evt) {
        scanError.value = 'Event not found'
        return
    }

    const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

    const payload: Record<string, unknown> = {
        user_id: auth.session.user.id,
        event_id: evt.id,
        event_title: evt.event_title,
        input_method: 'self',
        log_type: 'event',
        log_date: new Date().toISOString().split('T')[0],
        logged_at: new Date().toISOString(),
        logged_by: auth.session.user.id,
        logged_by_name: userName,
        logged_location_id: auth.profile?.satellite_church_id ?? null,
        logged_location_name: auth.profile?.satellite_church_name ?? null,
        program_id: null,
    }

    const { error } = await supabase.from('tbl_attendance_logs').insert(payload)

    if (error) {
        if (error.message.includes('unique') || error.message.includes('duplicate')) {
            scanError.value = 'You have already checked in to this event today'
        } else {
            scanError.value = error.message
        }
    } else {
        scanSuccess.value = { name: userName, title: evt.event_title }
    }
}

function resetScan() {
    scanResult.value = null
    scanError.value = null
    scanSuccess.value = null
}

// A study picked under one pastor shouldn't linger when the pastor changes.
watch(scanPastorId, () => { scanBibleStudyId.value = null })

// Load data when scan tab is selected
watch(activeTab, async (tab) => {
    stopScanner()
    if (tab === 'scan') await loadData()
})

watch(() => props.open, (open) => {
    if (!open) {
        stopScanner()
        activeTab.value = 'show'
        resetScan()
    }
})

onBeforeUnmount(() => { stopScanner() })
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

                <!-- Modal -->
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 scale-95 translate-y-4"
                    enter-to-class="opacity-100 scale-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="opacity-100 scale-100 translate-y-0"
                    leave-to-class="opacity-0 scale-95 translate-y-4"
                >
                    <div v-if="open" class="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6 text-center">
                        <!-- Close button -->
                        <button
                            @click="emit('close')"
                            class="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <!-- Tabs -->
                        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-5">
                            <button
                                v-for="tab in [{ key: 'show' as const, label: 'My QR' }, { key: 'scan' as const, label: 'Scan QR' }]"
                                :key="tab.key"
                                class="px-3 py-1 text-xs font-medium rounded transition-all"
                                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="activeTab = tab.key"
                            >
                                {{ tab.label }}
                            </button>
                        </div>

                        <!-- Show QR Tab -->
                        <template v-if="activeTab === 'show'">
                            <div v-if="loading" class="w-full aspect-square mx-auto bg-gray-100 rounded-lg animate-pulse" />

                            <div v-else-if="qrDataUrl" class="flex justify-center mb-4">
                                <img :src="qrDataUrl" alt="QR Code" class="w-full aspect-square rounded-lg" />
                            </div>

                            <div v-else class="w-full aspect-square mx-auto bg-gray-50 rounded-lg flex items-center justify-center mb-4">
                                <p class="text-sm text-gray-400 px-4">No QR token assigned yet.<br />Contact your admin.</p>
                            </div>

                            <p class="text-base font-heading font-semibold text-navy">
                                {{ auth.user?.first_name }} {{ auth.user?.last_name }}
                            </p>
                            <p class="text-xs text-gray-500 mt-0.5">
                                {{ auth.profile?.satellite_church_name ?? 'RCMI' }}
                            </p>
                            <p class="text-[11px] text-gray-300 mt-4">
                                Present this QR code for attendance scanning
                            </p>
                        </template>

                        <!-- Scan QR Tab -->
                        <template v-else>
                            <div v-if="!scanResult" class="space-y-4 text-left">
                                <!-- Log Type Toggle -->
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Log For</label>
                                    <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                                        <button
                                            v-for="t in [
                                                { key: 'event' as const, label: 'Event' },
                                                { key: 'program' as const, label: 'Program' },
                                                { key: 'bible_study' as const, label: 'Bible Study' },
                                            ]"
                                            :key="t.key"
                                            type="button"
                                            class="px-3 py-1.5 text-xs font-medium rounded transition-all"
                                            :class="scanLogType === t.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                            @click="scanLogType = t.key"
                                        >
                                            {{ t.label }}
                                        </button>
                                    </div>
                                </div>

                                <!-- Event Select -->
                                <div v-if="scanLogType === 'event'">
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Event</label>
                                    <select
                                        v-model="scanEventId"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    >
                                        <option :value="null" disabled>Select event</option>
                                        <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
                                            {{ opt.label }}
                                        </option>
                                    </select>
                                </div>

                                <!-- Program Select -->
                                <div v-else-if="scanLogType === 'program'">
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Program</label>
                                    <select
                                        v-model="scanProgramId"
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    >
                                        <option :value="null" disabled>Select program</option>
                                        <option v-for="p in programs" :key="p.id" :value="p.id">
                                            {{ p.type }}
                                        </option>
                                    </select>
                                </div>

                                <!-- Bible Study: pastor first, then their study -->
                                <template v-else>
                                    <div>
                                        <label class="block text-xs font-medium text-gray-700 mb-1">Pastor</label>
                                        <select
                                            v-model="scanPastorId"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                        >
                                            <option :value="null" disabled>Select pastor</option>
                                            <option v-for="p in pastors" :key="p.user_id" :value="p.user_id">
                                                {{ p.name }}
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label class="block text-xs font-medium text-gray-700 mb-1">Bible Study</label>
                                        <select
                                            v-model="scanBibleStudyId"
                                            :disabled="!scanPastorId"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:bg-gray-50 disabled:text-gray-400"
                                        >
                                            <option :value="null" disabled>
                                                {{ scanPastorId ? 'Select bible study' : 'Select a pastor first' }}
                                            </option>
                                            <option v-for="s in bibleStudyOptions" :key="s.id" :value="s.id">
                                                {{ s.title }}
                                            </option>
                                        </select>
                                    </div>
                                </template>

                                <p class="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                                    Scanning an <strong>Event QR</strong>? Just start the camera — no selection needed. Your attendance will be logged automatically.
                                </p>

                                <!-- Scanner -->
                                <div id="qr-reader" class="w-full aspect-square mx-auto rounded-lg overflow-hidden bg-gray-900" />

                                <div class="text-center">
                                    <button
                                        v-if="!scanning"
                                        :disabled="!canStartScan"
                                        @click="startScanner"
                                        class="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                        </svg>
                                        Start Camera
                                    </button>

                                    <p v-if="scanning" class="text-xs text-gray-400">Point camera at a QR code...</p>
                                </div>

                                <p v-if="scanError && !scanResult" class="text-xs text-red-500 text-center">{{ scanError }}</p>
                            </div>

                            <!-- Scan result -->
                            <div v-else class="space-y-4">
                                <!-- Success -->
                                <div v-if="scanSuccess" class="space-y-3">
                                    <div class="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                                        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <p class="text-base font-heading font-semibold text-navy">{{ scanSuccess.name }}</p>
                                    <p class="text-xs text-gray-500">{{ scanSuccess.title }}</p>
                                    <p class="text-xs text-green-600 font-medium">Checked in successfully</p>
                                </div>

                                <!-- Not found / error -->
                                <div v-else-if="scanError" class="space-y-3">
                                    <div class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                                        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <p class="text-xs text-red-500">{{ scanError }}</p>
                                </div>

                                <button
                                    @click="resetScan()"
                                    class="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                                >
                                    Scan Again
                                </button>
                            </div>
                        </template>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
:deep(#qr-reader video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    border-radius: 0.75rem;
}
:deep(#qr-reader) {
    border: none !important;
}
:deep(#qr-reader__scan_region) {
    min-height: auto !important;
}
:deep(#qr-reader__dashboard) {
    display: none !important;
}
</style>
