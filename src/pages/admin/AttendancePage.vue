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
const memberSearch = ref('')
const showMemberDropdown = ref(false)

// QR scanner
const {
  scannedToken,
  scanning,
  error: scanError,
  start: startScanner,
  stop: stopScanner,
  reset: resetScanner,
} = useQRScanner('qr-reader')
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
    .select('*')
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
    .filter((e) => e.is_active)
    .map((e) => ({ id: e.id, label: e.event_title, isDefault: false }))
  const defaults = defaultEvents.value.map((d) => ({
    id: -d.id,
    label: `${d.event_title} (Default)`,
    isDefault: true,
  }))
  return [...real, ...defaults]
})

// Resolve the real event title for logging (strip " (Default)" suffix)
function getEventTitleForLog(id: number | null) {
  if (!id) return null
  if (id > 0) {
    const evt = eventStore.events.find((e) => e.id === id)
    return evt?.event_title ?? null
  }
  const de = defaultEvents.value.find((d) => d.id === -id!)
  return de?.event_title ?? null
}

function getProgramName(id: number | null) {
  if (!id) return null
  return programs.value.find((p) => p.id === id)?.type ?? null
}

const availableMembers = computed(() => {
  const q = memberSearch.value.toLowerCase()
  const approved = admin.members.filter((m) => m.status === 'approved')
  if (!q) return approved.slice(0, 15)
  return approved
    .filter(
      (m) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    )
    .slice(0, 15)
})

const selectedEventData = computed(() => {
  const logType = activeTab.value === 'manual' ? manualLogType.value : qrLogType.value
  const id = activeTab.value === 'manual' ? manualForm.value.event_id : qrEventId.value

  if (logType !== 'event' || !id) return null
  if (id > 0) return eventStore.events.find((e) => e.id === id)
  return defaultEvents.value.find((d) => d.id === -id)
})

const isCheckinStarted = computed(() => {
  const logType = activeTab.value === 'manual' ? manualLogType.value : qrLogType.value
  if (logType === 'program') return true

  const event = selectedEventData.value
  if (!event) return false

  const now = new Date()
  let checkinStart: Date

  if ('duration_from' in event && event.duration_from) {
    // Real Event
    if ((event as any).checkin_start_at) {
      checkinStart = new Date((event as any).checkin_start_at)
    } else {
      // Default to 12:00 AM (midnight) on the event date
      checkinStart = new Date(event.duration_from)
      checkinStart.setHours(0, 0, 0, 0)
    }
  } else if ('default_checkin_time' in event) {
    // Default Event template
    const [h, m] = ((event as any).default_checkin_time || '00:00').split(':')
    checkinStart = new Date()
    checkinStart.setHours(parseInt(h), parseInt(m), 0, 0)
  } else {
    return true
  }

  return now >= checkinStart
})

function selectMember(m: any) {
  manualForm.value.user_id = m.user_id
  memberSearch.value = `${m.first_name} ${m.last_name}`
  showMemberDropdown.value = false
}

function hideMemberDropdown() {
  setTimeout(() => {
    showMemberDropdown.value = false
  }, 200)
}

onMounted(async () => {
  await Promise.all([
    fetchLogs(),
    admin.fetchMembers(),
    eventStore.fetchEvents(),
    fetchDefaultEvents(),
    fetchPrograms(),
  ])
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

function buildLogPayload(
  userId: string,
  logType: 'event' | 'program',
  eventId: number | null,
  programId: number | null,
  inputMethod: string,
) {
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
    message.value = {
      type: 'success',
      text: `${member?.first_name} ${member?.last_name} checked in.`,
    }
    manualForm.value = { user_id: '', event_id: null, program_id: null }
    memberSearch.value = ''
    await fetchLogs()
  }
  manualSaving.value = false
}

// QR scan handler
async function handleQRScan() {
  if (!scannedToken.value) return
  if (qrLogType.value === 'event' && !qrEventId.value) return
  if (qrLogType.value === 'program' && !qrProgramId.value) return

  if (!isCheckinStarted.value) {
    message.value = { type: 'error', text: "Check-in for this event hasn't started yet." }
    resetScanner()
    return
  }

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
    message.value = {
      type: 'success',
      text: `${profile.first_name} ${profile.last_name} scanned in!`,
    }
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
  message.value = null
  if (tab === 'qr') {
    await nextTick()
  } else {
    stopScanner()
  }
}

function getMemberName(userId: string | null) {
  if (!userId) return '—'
  const m = admin.members.find((m) => m.user_id === userId)
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
  return new Date(d).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-heading font-bold text-navy mb-6">Attendance Management</h1>

    <!-- Tabs -->
    <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-6 flex-wrap">
      <button
        v-for="tab in [
          { key: 'event' as const, label: 'By Event' },
          { key: 'member' as const, label: 'By Member' },
          { key: 'manual' as const, label: 'Manual Check-In' },
          { key: 'qr' as const, label: 'QR Scanner' },
        ]"
        :key="tab.key"
        class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
        :class="
          activeTab === tab.key
            ? 'bg-white text-navy shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        "
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
    <div
      v-if="activeTab === 'manual'"
      class="bg-white rounded-lg border border-gray-200 p-6 max-w-lg"
    >
      <h2 class="font-heading font-semibold text-navy mb-4">Manual Check-In</h2>
      <form @submit.prevent="handleManualCheckIn" class="space-y-4">
        <!-- Log Type Toggle -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Log For</label>
          <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded transition-all"
              :class="
                manualLogType === 'event'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              "
              @click="manualLogType = 'event'; manualForm.event_id = null"
            >
              Event
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded transition-all"
              :class="
                manualLogType === 'program'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              "
              @click="manualLogType = 'program'; manualForm.program_id = null"
            >
              Program
            </button>
          </div>
        </div>

        <!-- Event Select -->
        <div v-if="manualLogType === 'event'">
          <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
          <select
            v-model="manualForm.event_id"
            required
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option :value="null" disabled>Select event</option>
            <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Program Select -->
        <div v-else>
          <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            v-model="manualForm.program_id"
            required
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option :value="null" disabled>Select program</option>
            <option v-for="p in programs" :key="p.id" :value="p.id">
              {{ p.type }}
            </option>
          </select>
        </div>

        <!-- Member Search (Searchable) -->
        <div
          v-if="
            (manualLogType === 'event' && manualForm.event_id) ||
            (manualLogType === 'program' && manualForm.program_id)
          "
          class="relative"
        >
          <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>

          <div
            v-if="manualLogType === 'event' && !isCheckinStarted"
            class="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 flex items-start gap-3"
          >
            <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <svg
                class="w-4 h-4 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-amber-800">Check-in not yet started</p>
              <p class="text-[11px] text-amber-700/80 mt-0.5">
                Please wait until the designated check-in time for this event.
              </p>
            </div>
          </div>

          <template v-else>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  class="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                v-model="memberSearch"
                type="text"
                placeholder="Search member to check in..."
                @focus="showMemberDropdown = true"
                @blur="hideMemberDropdown"
                class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-4 focus:ring-navy/5 focus:border-navy transition-all"
              />
            </div>

            <!-- Search Dropdown -->
            <div
              v-if="showMemberDropdown"
              class="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden py-1"
            >
              <div class="px-3 py-2 border-b border-gray-50 bg-gray-50/50">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                  >Available Members</span
                >
              </div>
              <div class="max-h-64 overflow-y-auto">
                <div
                  v-for="m in availableMembers"
                  :key="m.user_id"
                  @mousedown="selectMember(m)"
                  class="flex items-center gap-3 px-3 py-2.5 hover:bg-navy/5 cursor-pointer transition-colors group"
                >
                  <div
                    class="w-9 h-9 rounded-full overflow-hidden bg-navy/5 flex items-center justify-center shrink-0 border-2 border-white group-hover:border-navy/10"
                  >
                    <img
                      v-if="m.profile_photo_url"
                      :src="m.profile_photo_url"
                      class="w-full h-full object-cover"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy/10 to-navy/5"
                    >
                      <span class="text-xs font-bold text-navy/40"
                        >{{ m.first_name?.[0] }}{{ m.last_name?.[0] }}</span
                      >
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900 truncate">
                      {{ m.first_name }} {{ m.last_name }}
                    </p>
                    <p class="text-[11px] text-gray-400 truncate">{{ m.email }}</p>
                  </div>
                </div>
                <div v-if="!availableMembers.length" class="px-3 py-8 text-center">
                  <p class="text-xs text-gray-400">No members found matching your search</p>
                </div>
              </div>
            </div>
          </template>
        </div>

        <button
          type="submit"
          :disabled="manualSaving || !isCheckinStarted || !manualForm.user_id"
          class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
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
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded transition-all"
              :class="
                qrLogType === 'event'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              "
              @click="qrLogType = 'event'"
            >
              Event
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded transition-all"
              :class="
                qrLogType === 'program'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              "
              @click="qrLogType = 'program'"
            >
              Program
            </button>
          </div>
        </div>

        <!-- Event Select -->
        <div v-if="qrLogType === 'event'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
          <select
            v-model="qrEventId"
            required
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option :value="null" disabled>Select event first</option>
            <option v-for="opt in allEventOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Program Select -->
        <div v-else class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
          <select
            v-model="qrProgramId"
            required
            class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
          >
            <option :value="null" disabled>Select program first</option>
            <option v-for="p in programs" :key="p.id" :value="p.id">
              {{ p.type }}
            </option>
          </select>
        </div>

        <div id="qr-reader" class="w-full mb-4 rounded-lg overflow-hidden" />

        <div class="flex gap-3">
          <button
            v-if="!scanning"
            :disabled="
              (qrLogType === 'event' && !qrEventId) || (qrLogType === 'program' && !qrProgramId)
            "
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
          placeholder="Search by event, program, name, or location..."
          class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
        />
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
      </div>

      <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">
        No attendance records.
      </div>

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
                <td class="px-4 py-3 font-medium text-gray-900">
                  {{ getMemberName(log.user_id) }}
                </td>
                <td class="px-4 py-3">
                  <span
                    class="text-xs px-2 py-0.5 rounded-full font-medium"
                    :class="
                      log.log_type === 'program'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-blue-50 text-blue-700'
                    "
                  >
                    {{ getLogTypeBadge(log) }}
                  </span>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">{{ getLogTitle(log) }}</td>
                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">
                  {{ log.logged_by_name ?? '—' }}
                </td>
                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">
                  {{ log.logged_location_name ?? '—' }}
                </td>
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
                <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                  {{ formatTime(log.logged_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
