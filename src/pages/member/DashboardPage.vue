<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from 'chart.js'
import { useAuthStore } from '@/stores/auth.store'
import { useAttendanceStore } from '@/stores/attendance.store'
import { useMemberStore } from '@/stores/member.store'
import { useAnnouncementStore } from '@/stores/announcement.store'
import { useQR } from '@/composables/useQR'
import { useRsvp } from '@/composables/useRsvp'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const auth = useAuthStore()
const attendance = useAttendanceStore()
const member = useMemberStore()
const announcementStore = useAnnouncementStore()
const { rsvps, rsvpCounts, fetchRsvps, setRsvp } = useRsvp()

const upcomingEvents = ref<Tables<'tbl_events'>[]>([])
const birthdays = ref<{ name: string; birthday: string; daysUntil: number }[]>([])
const pageLoading = ref(true)

const { qrDataUrl } = useQR(() => auth.profile?.qr_token)

onMounted(async () => {
    await Promise.all([
        attendance.fetchMyLogs(),
        member.fetchProfile(),
        member.fetchNetworkProfile(),
        member.fetchPrograms(),
        fetchUpcomingEvents(),
        fetchUpcomingBirthdays(),
        announcementStore.fetchAnnouncements(),
    ])
    pageLoading.value = false
})

async function fetchUpcomingEvents() {
    const now = new Date().toISOString()
    const { data } = await supabase
        .from('tbl_events')
        .select('*')
        .gte('duration_to', now)
        .eq('is_active', true)
        .order('duration_from', { ascending: true })
        .limit(5)
    upcomingEvents.value = data ?? []
    if (data?.length) {
        await fetchRsvps(data.map((e) => e.id))
    }
}

async function fetchUpcomingBirthdays() {
    const churchId = auth.profile?.satellite_church_id
    let query = supabase
        .from('tbl_members_profile')
        .select('first_name, last_name, date_of_birth')
        .not('date_of_birth', 'is', null)
        .eq('status', 'approved')

    if (churchId) query = query.eq('satellite_church_id', churchId)

    const { data } = await query

    if (!data) return

    const today = new Date()
    const results: { name: string; birthday: string; daysUntil: number }[] = []

    for (const m of data) {
        if (!m.date_of_birth) continue
        const bday = new Date(m.date_of_birth)
        const nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
        if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1)
        const diff = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 30) {
            results.push({
                name: [m.first_name, m.last_name].filter(Boolean).join(' '),
                birthday: bday.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
                daysUntil: diff,
            })
        }
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil)
    birthdays.value = results.slice(0, 10)
}

// Stats
const totalAttendance = computed(() => attendance.logs.length)
const enrolledPrograms = computed(() => member.programs.filter((p) => p.is_active === 'Y').length)
const completedPrograms = computed(() =>
    member.programs.filter((p) => p.is_active !== 'Y' && p.date_ended).length,
)

// Greeting based on time of day
const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
})

// Monthly attendance chart data
const chartData = computed(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return d
    })

    const labels = months.map((d) => d.toLocaleDateString('en', { month: 'short' }))
    const counts = months.map((d) => {
        const y = d.getFullYear()
        const m = d.getMonth()
        return attendance.logs.filter((l) => {
            if (!l.log_date) return false
            const ld = new Date(l.log_date)
            return ld.getFullYear() === y && ld.getMonth() === m
        }).length
    })

    return {
        labels,
        datasets: [
            {
                label: 'Attendance',
                data: counts,
                borderColor: '#091f55',
                backgroundColor: 'rgba(9,31,85,0.08)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#091f55',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    }
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#091f55', cornerRadius: 8, padding: 10, titleFont: { size: 13 }, bodyFont: { size: 12 } } },
    scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
        x: { grid: { display: false } },
    },
}

const pinnedAnnouncements = computed(() =>
    announcementStore.announcements.filter((a) => a.is_pinned).slice(0, 3),
)

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEventTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function getRsvpStatus(eventId: number) {
    return rsvps.value.get(eventId)?.status ?? null
}

function getRsvpCount(eventId: number) {
    return rsvpCounts.value.get(eventId) ?? { going: 0, maybe: 0 }
}
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <!-- Welcome Banner -->
        <div class="relative overflow-hidden rounded-2xl mb-8">
            <div class="absolute inset-0 bg-gradient-to-br from-navy via-navy-700 to-navy-600" />
            <div class="absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;" />
            <div class="relative px-6 py-8 sm:px-8 sm:py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                    <p class="text-navy-200 text-sm font-medium mb-1">
                        {{ new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }) }}
                    </p>
                    <h1 class="text-2xl sm:text-3xl font-heading font-bold text-white mb-2">
                        {{ greeting }}, {{ auth.user?.first_name }}
                    </h1>
                    <p class="text-white/60 text-sm">
                        {{ auth.profile?.satellite_church_name ?? 'RCMI' }} Member
                    </p>
                </div>
                <div v-if="qrDataUrl" class="bg-white rounded-2xl p-2.5 shadow-lg shadow-black/20 shrink-0 self-start sm:self-center">
                    <img :src="qrDataUrl" alt="QR Code" class="w-24 h-24 sm:w-28 sm:h-28" />
                </div>
            </div>
        </div>

        <!-- Pinned Announcements -->
        <div v-if="pinnedAnnouncements.length" class="mb-8 space-y-3">
            <div
                v-for="a in pinnedAnnouncements"
                :key="a.id"
                class="bg-gradient-to-r from-gold-50 to-gold-100/50 border border-gold-200/60 rounded-xl px-5 py-4 flex items-start gap-4"
            >
                <div class="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
                    <svg class="w-4.5 h-4.5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
                    </svg>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-gray-900">{{ a.title }}</p>
                    <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">{{ a.content }}</p>
                </div>
            </div>
        </div>

        <!-- Loading skeleton -->
        <template v-if="pageLoading">
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div v-for="i in 4" :key="i" class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse">
                    <div class="h-4 bg-gray-200 rounded w-24 mb-4" />
                    <div class="h-8 bg-gray-200 rounded w-14" />
                </div>
            </div>
        </template>

        <template v-else>
            <!-- Stat Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div class="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-navy/10 transition-all duration-300">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-navy/[0.06] flex items-center justify-center">
                            <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Services Attended</p>
                    <p class="text-3xl font-heading font-bold text-navy">{{ totalAttendance }}</p>
                </div>
                <div class="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-navy/10 transition-all duration-300">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">This Month</p>
                    <p class="text-3xl font-heading font-bold text-navy">
                        {{ chartData.datasets[0].data[chartData.datasets[0].data.length - 1] }}
                    </p>
                </div>
                <div class="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-navy/10 transition-all duration-300">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                            </svg>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Enrolled Programs</p>
                    <p class="text-3xl font-heading font-bold text-navy">{{ enrolledPrograms }}</p>
                </div>
                <div class="group bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-navy/10 transition-all duration-300">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                            <svg class="w-5 h-5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Completed</p>
                    <p class="text-3xl font-heading font-bold text-gold-600">{{ completedPrograms }}</p>
                </div>
            </div>

            <!-- Main grid -->
            <div class="grid lg:grid-cols-3 gap-6">
                <!-- Left column -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Attendance Chart -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-5">
                            <div>
                                <h2 class="font-heading font-semibold text-navy text-lg">Monthly Attendance</h2>
                                <p class="text-xs text-gray-400 mt-0.5">Last 6 months</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-navy/[0.06] flex items-center justify-center">
                                <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                                </svg>
                            </div>
                        </div>
                        <div class="h-52">
                            <Line :data="chartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- Upcoming Events with RSVP -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-5">
                            <div>
                                <h2 class="font-heading font-semibold text-navy text-lg">Upcoming Events</h2>
                                <p class="text-xs text-gray-400 mt-0.5">{{ upcomingEvents.length }} event{{ upcomingEvents.length !== 1 ? 's' : '' }} coming up</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-navy/[0.06] flex items-center justify-center">
                                <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                            </div>
                        </div>
                        <div v-if="!upcomingEvents.length" class="text-sm text-gray-400 py-8 text-center">
                            <svg class="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            No upcoming events
                        </div>
                        <div v-else class="space-y-3">
                            <div
                                v-for="evt in upcomingEvents"
                                :key="evt.id"
                                class="group/event p-4 rounded-xl bg-gray-50/80 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-200"
                            >
                                <div class="flex items-start gap-4">
                                    <div class="w-12 h-12 rounded-xl bg-navy/[0.08] flex flex-col items-center justify-center text-navy shrink-0">
                                        <span class="text-[10px] uppercase font-semibold leading-none text-navy/60">
                                            {{ new Date(evt.duration_from!).toLocaleDateString('en', { month: 'short' }) }}
                                        </span>
                                        <span class="text-lg font-heading font-bold leading-tight">
                                            {{ new Date(evt.duration_from!).getDate() }}
                                        </span>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-semibold text-gray-900 truncate">{{ evt.event_title }}</p>
                                        <p class="text-xs text-gray-500 mt-0.5">
                                            {{ formatEventTime(evt.duration_from) }}
                                            <span v-if="evt.event_type" class="text-gray-300 mx-1">&middot;</span>
                                            <span v-if="evt.event_type" class="text-gray-400">{{ evt.event_type }}</span>
                                        </p>
                                    </div>
                                </div>
                                <!-- RSVP buttons -->
                                <div class="flex items-center gap-2 mt-3 ml-16">
                                    <button
                                        class="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'going' ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-200'"
                                        @click="setRsvp(evt.id, 'going')"
                                    >
                                        Going {{ getRsvpCount(evt.id).going > 0 ? `(${getRsvpCount(evt.id).going})` : '' }}
                                    </button>
                                    <button
                                        class="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'maybe' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-600 border border-gray-200 hover:border-amber-200'"
                                        @click="setRsvp(evt.id, 'maybe')"
                                    >
                                        Maybe {{ getRsvpCount(evt.id).maybe > 0 ? `(${getRsvpCount(evt.id).maybe})` : '' }}
                                    </button>
                                    <button
                                        class="text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'not_going' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200'"
                                        @click="setRsvp(evt.id, 'not_going')"
                                    >
                                        Can't Go
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Enrolled Programs -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-5">
                            <div>
                                <h2 class="font-heading font-semibold text-navy text-lg">Enrolled Programs</h2>
                                <p class="text-xs text-gray-400 mt-0.5">{{ enrolledPrograms }} active program{{ enrolledPrograms !== 1 ? 's' : '' }}</p>
                            </div>
                            <router-link
                                :to="{ name: 'member-programs' }"
                                class="text-xs text-navy/60 hover:text-navy font-medium transition-colors"
                            >
                                View all
                            </router-link>
                        </div>
                        <div v-if="!member.programs.filter(p => p.is_active === 'Y').length" class="text-sm text-gray-400 py-8 text-center">
                            <svg class="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                            </svg>
                            No enrolled programs
                        </div>
                        <div v-else class="space-y-3">
                            <div
                                v-for="prog in member.programs.filter(p => p.is_active === 'Y')"
                                :key="prog.id"
                                class="p-4 rounded-xl bg-gray-50/80 border border-transparent hover:border-gray-100 transition-all duration-200"
                            >
                                <div class="flex justify-between items-center mb-1.5">
                                    <p class="text-sm font-semibold text-gray-900">{{ prog.program_type }}</p>
                                    <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium">Active</span>
                                </div>
                                <p class="text-xs text-gray-400">Started {{ formatDate(prog.date_started) }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right column -->
                <div class="space-y-6">
                    <!-- QR Code Widget -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 text-center">
                        <h2 class="font-heading font-semibold text-navy text-lg mb-4">My QR Code</h2>
                        <div v-if="qrDataUrl" class="flex justify-center">
                            <div class="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <img :src="qrDataUrl" alt="QR Code" class="w-36 h-36" />
                            </div>
                        </div>
                        <div v-else class="w-36 h-36 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                            <span class="text-xs text-gray-400">No QR token</span>
                        </div>
                        <p class="text-xs text-gray-400 mt-3">Show this for attendance scanning</p>
                        <router-link
                            :to="{ name: 'member-qr' }"
                            class="inline-flex items-center gap-1.5 mt-4 text-sm text-navy font-medium hover:text-navy-600 transition-colors"
                        >
                            View Full Size
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </router-link>
                    </div>

                    <!-- Birthday Reminders -->
                    <div v-if="birthdays.length" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="font-heading font-semibold text-navy text-lg">Birthdays</h2>
                            <div class="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                                <svg class="w-4.5 h-4.5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.126-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z" />
                                </svg>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <div
                                v-for="b in birthdays"
                                :key="b.name"
                                class="flex items-center gap-3.5"
                            >
                                <div class="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-sm font-bold text-navy/40 shrink-0 border border-gray-100">
                                    {{ b.name.split(' ').map(n => n[0]).join('') }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-800 truncate">{{ b.name }}</p>
                                    <p class="text-xs text-gray-400">{{ b.birthday }}</p>
                                </div>
                                <span
                                    class="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0"
                                    :class="b.daysUntil === 0 ? 'bg-gold/15 text-gold-700' : 'bg-gray-50 text-gray-500 border border-gray-100'"
                                >
                                    {{ b.daysUntil === 0 ? 'Today!' : `${b.daysUntil}d` }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Network Profile -->
                    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="font-heading font-semibold text-navy text-lg">My Network</h2>
                            <div class="w-9 h-9 rounded-xl bg-navy/[0.06] flex items-center justify-center">
                                <svg class="w-4.5 h-4.5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                </svg>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="flex items-center gap-3.5">
                                <div class="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                                    <svg class="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Pastor</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">
                                        {{ member.network.pastor?.name ?? 'Not assigned' }}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3.5">
                                <div class="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                    <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Network Leader</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">
                                        {{ member.network.networkLeader?.name ?? 'Not assigned' }}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3.5">
                                <div class="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                                    <svg class="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[11px] text-gray-400 uppercase tracking-wider font-medium">L-Path Leader</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">
                                        {{ member.network.lpathLeader?.name ?? 'Not assigned' }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Church Info -->
                    <div class="bg-gradient-to-br from-navy to-navy-700 rounded-2xl p-5 sm:p-6 text-white">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                                <svg class="w-4.5 h-4.5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                                </svg>
                            </div>
                            <h2 class="font-heading font-semibold text-lg">My Church</h2>
                        </div>
                        <p class="text-base font-semibold text-white">
                            {{ auth.profile?.satellite_church_name ?? 'Not assigned' }}
                        </p>
                        <p class="text-sm text-white/50 mt-1">Member since {{ formatDate(auth.profile?.created_at ?? null) }}</p>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
