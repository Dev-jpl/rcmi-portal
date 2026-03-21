<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAttendanceStore } from '@/stores/attendance.store'
import type { Tables } from '@/types/database.types'

const auth = useAuthStore()
const attendance = useAttendanceStore()

type Event = Tables<'tbl_events'>

const events = ref<Event[]>([])
const loading = ref(true)
const checkedIn = ref<Set<number>>(new Set())
const checkingIn = ref<number | null>(null)
const messages = ref<Record<number, { type: 'success' | 'error'; text: string }>>({})

onMounted(async () => {
    await Promise.all([fetchActiveEvents(), attendance.fetchMyLogs()])
    markAlreadyCheckedIn()
    loading.value = false
})

async function fetchActiveEvents() {
    const now = new Date().toISOString()
    const churchId = auth.profile?.satellite_church_id

    let query = supabase
        .from('tbl_events')
        .select('*')
        .eq('is_active', true)
        .lte('duration_from', now)
        .gte('duration_to', now)
        .order('duration_from')

    if (churchId) {
        query = query.or(`satellite_church_id.eq.${churchId},satellite_church_id.is.null`)
    }

    const { data } = await query
    // Only show events that allow self check-in
    events.value = (data ?? []).filter((e: any) => e.allow_self_checkin !== false)
}

function markAlreadyCheckedIn() {
    const today = new Date().toISOString().split('T')[0]
    for (const log of attendance.logs) {
        if (log.log_date === today && log.event_id) {
            checkedIn.value.add(log.event_id)
        }
    }
}

async function handleCheckIn(event: Event) {
    checkingIn.value = event.id
    delete messages.value[event.id]

    const result = await attendance.selfCheckIn(event)

    if (result.success) {
        checkedIn.value.add(event.id)
        messages.value[event.id] = { type: 'success', text: 'Checked in successfully!' }
    } else {
        messages.value[event.id] = { type: 'error', text: result.error ?? 'Check-in failed' }
        if (result.error?.includes('Already')) {
            checkedIn.value.add(event.id)
        }
    }
    checkingIn.value = null
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
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                            <span v-if="event.event_type" class="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                {{ event.event_type }}
                            </span>
                        </p>
                    </div>
                </div>

                <!-- Already checked in -->
                <div v-if="checkedIn.has(event.id)" class="mt-4">
                    <div class="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg px-4 py-2.5">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="text-sm font-medium">Checked In</span>
                    </div>
                </div>

                <!-- Check-in button -->
                <button
                    v-else
                    :disabled="checkingIn === event.id"
                    class="mt-4 w-full py-3 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors text-sm"
                    @click="handleCheckIn(event)"
                >
                    {{ checkingIn === event.id ? 'Checking in...' : 'Check In Now' }}
                </button>

                <!-- Message -->
                <p
                    v-if="messages[event.id]"
                    class="mt-2 text-sm rounded-lg px-3 py-2"
                    :class="messages[event.id].type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
                >
                    {{ messages[event.id].text }}
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
