<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAttendanceStore } from '@/stores/attendance.store'
import { useEventStore } from '@/stores/event.store'
import type { Tables } from '@/types/database.types'

const auth = useAuthStore()
const attendance = useAttendanceStore()
const eventStore = useEventStore()

type Event = Tables<'tbl_events'>
type DefaultEvent = Tables<'lib_default_events'>

const events = ref<(Event & { isTemplate?: boolean; templateData?: DefaultEvent })[]>([])
const loading = ref(true)
const checkedIn = ref<Set<string>>(new Set())
const checkingIn = ref<string | null>(null)
const messages = ref<Record<string, { type: 'success' | 'error'; text: string }>>({})

onMounted(async () => {
  await Promise.all([fetchActiveEvents(), attendance.fetchMyLogs()])
  markAlreadyCheckedIn()
  loading.value = false
})

async function fetchActiveEvents() {
  const nowLocal = new Date()
  const nowIso = nowLocal.toISOString()
  const churchId = auth.profile?.satellite_church_id
  const currentDay = nowLocal.toLocaleDateString('en-US', { weekday: 'long' })
  const currentHour = nowLocal.getHours()

  // 1. Fetch actual events (manual/special)
  let query = supabase
    .from('tbl_events')
    .select('*')
    .eq('is_active', true)
    .gte('duration_to', nowIso)
    .order('duration_from')

  if (churchId) {
    query = query.or(`satellite_church_id.eq.${churchId},satellite_church_id.is.null`)
  }

  const { data: tblEvents } = await query
  const activeTblEvents = (tblEvents ?? []).filter((e) => e.allow_self_checkin !== false) as Event[]

  // 2. Fetch default events if visibility window is open (>= 1 AM)
  let defaultEvents: any[] = []

  if (currentHour >= 1) {
    const { data: templates } = await supabase
      .from('lib_default_events')
      .select('*')
      .eq('is_active', true)
      .eq('allow_self_checkin', true)
      .eq('day_of_week', currentDay)

    if (templates) {
      const today = new Date().toISOString().split('T')[0]

      // Look up any already-materialized tbl_events for these templates today
      const templateDbIds = templates.map((t) => Number(t.id))
      const { data: materialized } = await supabase
        .from('tbl_events')
        .select('id, default_event_id')
        .in('default_event_id', templateDbIds)
        .gte('duration_from', `${today}T00:00:00`)
        .lte('duration_from', `${today}T23:59:59`)

      // Map template DB id → real event UUID
      const materializedMap = new Map<number, string>(
        (materialized ?? []).map((e) => [e.default_event_id as number, e.id])
      )

      defaultEvents = templates.map((t) => {
        const realId = materializedMap.get(Number(t.id))
        return {
          id: realId ?? t.id, // use real event UUID if already materialized
          event_title: t.event_title,
          event_type: t.event_type,
          duration_from: `${today}T${t.default_start_time || '00:00'}:00`,
          duration_to: `${today}T${t.default_end_time || '23:59'}:00`,
          is_active: true,
          allow_self_checkin: true,
          isTemplate: true,
          templateData: t,
          satellite_church_id: churchId || null,
        }
      })
    }
  }

  // Merge and sort
  events.value = [...activeTblEvents, ...defaultEvents].sort(
    (a, b) => new Date(a.duration_from!).getTime() - new Date(b.duration_from!).getTime(),
  )
}

function markAlreadyCheckedIn() {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  for (const log of attendance.logs) {
    if (log.log_date === today && log.event_id) {
      checkedIn.value.add(log.event_id)
    }
  }
}

async function handleCheckIn(event: Event & { isTemplate?: boolean; templateData?: DefaultEvent }) {
  const eventKey = event.id
  checkingIn.value = eventKey
  delete messages.value[eventKey]

  let targetEvent = event

  // If it's a template, materialize it first
  if (event.isTemplate && event.templateData) {
    const result = await eventStore.findOrCreateFromDefault(event.templateData)
    if (!result.success || !result.data) {
      messages.value[eventKey] = { type: 'error', text: result.error ?? 'Failed to prepare event' }
      checkingIn.value = null
      return
    }
    targetEvent = result.data
  }

  const result = await attendance.selfCheckIn(targetEvent)

  if (result.success) {
    checkedIn.value.add(targetEvent.id)
    if (event.isTemplate) {
      checkedIn.value.add(event.id)
    }
    messages.value[eventKey] = { type: 'success', text: 'Checked in successfully!' }
  } else {
    messages.value[eventKey] = { type: 'error', text: result.error ?? 'Check-in failed' }
    if (result.error?.includes('Already')) {
      checkedIn.value.add(targetEvent.id)
      if (event.isTemplate) checkedIn.value.add(event.id)
    }
  }
  checkingIn.value = null
}

const now = ref(new Date())
let nowTimer: ReturnType<typeof setInterval>

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = new Date()
  }, 30_000) // update every 30s
})

onUnmounted(() => clearInterval(nowTimer))

function hasStarted(event: Event & { isTemplate?: boolean }): boolean {
  if (event.isTemplate) return true
  if (!event.duration_from) return true
  return now.value >= new Date(event.duration_from)
}

function formatTime(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="max-w-xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-navy">Self Check-In</h1>
      <p class="text-sm text-gray-500 mt-1">Tap an event below to check in</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-200 rounded-xl animate-pulse" />
    </div>

    <!-- No events -->
    <div v-else-if="!events.length" class="text-center py-16">
      <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p class="text-gray-400">No active events right now</p>
      <p class="text-xs text-gray-300 mt-1">Check back during service or event hours</p>
    </div>

    <!-- Events list -->
    <div v-else class="space-y-4">
      <div
        v-for="event in events"
        :key="event.id"
        class="bg-white rounded-xl border border-gray-200 p-5 transition-shadow hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="font-heading font-semibold text-navy text-lg">{{ event.event_title }}</h3>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ formatTime(event.duration_from) }} – {{ formatTime(event.duration_to) }}
              <span
                v-if="event.event_type"
                class="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full"
              >
                {{ event.event_type }}
              </span>
            </p>
          </div>
        </div>

        <!-- Already checked in -->
        <div v-if="checkedIn.has(event.id)" class="mt-4">
          <div class="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg px-4 py-2.5">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span class="text-sm font-medium">Checked In</span>
          </div>
        </div>

        <!-- Check-in button -->
        <div v-else class="mt-4">
          <button
            :disabled="checkingIn === event.id || !hasStarted(event)"
            class="w-full py-3 font-semibold rounded-lg transition-colors text-sm"
            :class="
              hasStarted(event)
                ? 'bg-navy text-white hover:bg-navy-700 disabled:opacity-50'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            "
            @click="handleCheckIn(event)"
          >
            {{
              checkingIn === event.id
                ? 'Checking in...'
                : hasStarted(event)
                  ? 'Check In Now'
                  : 'Not Yet Started'
            }}
          </button>
          <p v-if="!hasStarted(event)" class="text-xs text-gray-400 text-center mt-1.5">
            Check-in opens at {{ formatTime(event.duration_from) }}
          </p>
        </div>

        <!-- Message -->
        <p
          v-if="messages[event.id]"
          class="mt-2 text-sm rounded-lg px-3 py-2"
          :class="
            messages[event.id]?.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          "
        >
          {{ messages[event.id]?.text }}
        </p>
      </div>
    </div>

    <!-- Back link -->
    <div class="mt-6 text-center">
      <router-link
        :to="{ name: 'member-attendance' }"
        class="text-sm text-gray-500 hover:text-navy transition-colors"
      >
        &larr; Back to Attendance History
      </router-link>
    </div>
  </div>
</template>
