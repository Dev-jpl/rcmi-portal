<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const auth = useAuthStore()
const admin = useAdminStore()

const pageLoading = ref(true)
const eventsThisMonth = ref(0)
const attendanceLogs = ref<any[]>([])
const churches = ref<{ id: number; church_name: string; count: number }[]>([])

// Date range filter
const dateRange = ref<'7d' | '30d' | '90d' | '1y'>('7d')
const dateRangeOptions = [
    { value: '7d' as const, label: '7 days' },
    { value: '30d' as const, label: '30 days' },
    { value: '90d' as const, label: '90 days' },
    { value: '1y' as const, label: '1 year' },
]

function getDateFrom(range: string): Date {
    const now = new Date()
    switch (range) {
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        case '1y': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
}

onMounted(async () => {
    await Promise.all([
        admin.fetchMembers(),
        fetchEventsThisMonth(),
        fetchAttendance(),
        fetchChurchCounts(),
    ])
    pageLoading.value = false
})

watch(dateRange, () => fetchAttendance())

const totalMembers = computed(() => admin.members.length)
const activeMembers = computed(() =>
    admin.members.filter((m) => m.status === 'approved').length,
)
const pendingCount = computed(() => admin.pendingMembers.length)

// Inactive members (no attendance in last 30 days)
const inactiveCount = computed(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const activeUserIds = new Set(
        attendanceLogs.value
            .filter((l) => l.log_date >= thirtyDaysAgo)
            .map((l) => l.user_id),
    )
    return admin.members.filter((m) => m.status === 'approved' && !activeUserIds.has(m.user_id)).length
})

async function fetchEventsThisMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

    let query = supabase
        .from('tbl_events')
        .select('id', { count: 'exact', head: true })
        .gte('duration_from', start)
        .lte('duration_from', end)

    const churchScope = admin.getChurchScope()
    if (churchScope) {
        query = query.or(`satellite_church_id.eq.${churchScope},satellite_church_id.is.null`)
    }

    const { count } = await query
    eventsThisMonth.value = count ?? 0
}

async function fetchAttendance() {
    const fromDate = getDateFrom(dateRange.value)

    let query = supabase
        .from('tbl_attendance_logs')
        .select('*')
        .gte('log_date', fromDate.toISOString().split('T')[0])

    const churchScope = admin.getChurchScope()
    if (churchScope) {
        query = query.eq('logged_location_id', churchScope)
    }

    const { data } = await query
    attendanceLogs.value = data ?? []
}

async function fetchChurchCounts() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .eq('is_active', true)
        .order('church_name')

    if (!data) return

    const countMap: Record<number, number> = {}
    for (const m of admin.members) {
        if (m.satellite_church_id && m.status === 'approved') {
            countMap[m.satellite_church_id] = (countMap[m.satellite_church_id] ?? 0) + 1
        }
    }

    churches.value = data.map((c) => ({
        id: c.id,
        church_name: c.church_name,
        count: countMap[c.id] ?? 0,
    }))
}

// Attendance chart — adapts to selected date range
const attendanceChartData = computed(() => {
    const fromDate = getDateFrom(dateRange.value)
    const now = new Date()
    const diffDays = Math.ceil((now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))

    let labels: string[] = []
    let counts: number[] = []

    if (diffDays <= 14) {
        // Daily view
        for (let i = diffDays; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
            const key = d.toISOString().split('T')[0]
            labels.push(d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }))
            counts.push(attendanceLogs.value.filter((l) => l.log_date === key).length)
        }
    } else if (diffDays <= 90) {
        // Weekly view
        const weeks = Math.ceil(diffDays / 7)
        for (let i = weeks - 1; i >= 0; i--) {
            const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
            const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
            const startKey = weekStart.toISOString().split('T')[0]
            const endKey = weekEnd.toISOString().split('T')[0]
            labels.push(weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' }))
            counts.push(attendanceLogs.value.filter((l) => l.log_date >= startKey && l.log_date <= endKey).length)
        }
    } else {
        // Monthly view
        const months = Math.ceil(diffDays / 30)
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const y = d.getFullYear()
            const m = d.getMonth()
            labels.push(d.toLocaleDateString('en', { month: 'short', year: '2-digit' }))
            counts.push(attendanceLogs.value.filter((l) => {
                if (!l.log_date) return false
                const ld = new Date(l.log_date)
                return ld.getFullYear() === y && ld.getMonth() === m
            }).length)
        }
    }

    return {
        labels,
        datasets: [
            {
                label: 'Attendance',
                data: counts,
                backgroundColor: 'rgba(9, 31, 85, 0.85)',
                hoverBackgroundColor: '#091f55',
                borderRadius: 8,
                borderSkipped: false,
            },
        ],
    }
})

const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#091f55', cornerRadius: 8, padding: 10, titleFont: { size: 13 }, bodyFont: { size: 12 } },
    },
    scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
        x: { grid: { display: false } },
    },
}

const statusChartData = computed(() => ({
    labels: ['Approved', 'Pending', 'Rejected'],
    datasets: [
        {
            data: [
                admin.members.filter((m) => m.status === 'approved').length,
                admin.members.filter((m) => m.status === 'pending').length,
                admin.members.filter((m) => m.status === 'rejected').length,
            ],
            backgroundColor: ['#091f55', '#fce32c', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 6,
        },
    ],
}))

const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
        legend: { position: 'bottom' as const, labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12 } } },
        tooltip: { backgroundColor: '#091f55', cornerRadius: 8, padding: 10 },
    },
}

// Greeting based on time
const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
})
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
                <p class="text-sm text-gray-400 font-medium mb-1">{{ greeting }}, {{ auth.user?.first_name }}</p>
                <h1 class="text-2xl sm:text-3xl font-heading font-bold text-navy">Admin Dashboard</h1>
            </div>
            <p class="text-sm text-gray-400">
                {{ new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }}
            </p>
        </div>

        <!-- Loading -->
        <template v-if="pageLoading">
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div v-for="i in 5" :key="i" class="bg-white rounded-lg p-4 border border-gray-200 animate-pulse">
                    <div class="h-3 bg-gray-200 rounded w-20 mb-2" />
                    <div class="h-6 bg-gray-200 rounded w-12" />
                </div>
            </div>
        </template>

        <template v-else>
            <!-- Stat Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <!-- Total Members -->
                <div class="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Members</p>
                    <p class="text-2xl font-heading font-bold text-navy">{{ totalMembers }}</p>
                </div>

                <!-- Active -->
                <div class="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Active</p>
                    <p class="text-2xl font-heading font-bold text-emerald-600">{{ activeMembers }}</p>
                </div>

                <!-- Pending -->
                <div class="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <div class="flex items-center justify-between">
                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Pending</p>
                        <span v-if="pendingCount > 0" class="w-2 h-2 rounded-full bg-gold animate-pulse" />
                    </div>
                    <p class="text-2xl font-heading font-bold text-gold-600">{{ pendingCount }}</p>
                    <router-link
                        v-if="pendingCount > 0"
                        :to="{ name: 'admin-members' }"
                        class="inline-flex items-center gap-1 text-xs text-navy/60 hover:text-navy font-medium mt-1 transition-colors"
                    >
                        Review now
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </router-link>
                </div>

                <!-- Inactive -->
                <div class="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Inactive (30d)</p>
                    <p class="text-2xl font-heading font-bold text-red-500">{{ inactiveCount }}</p>
                </div>

                <!-- Events This Month -->
                <div class="bg-white rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Events This Month</p>
                    <p class="text-2xl font-heading font-bold text-navy">{{ eventsThisMonth }}</p>
                </div>
            </div>

            <!-- Charts row -->
            <div class="grid lg:grid-cols-3 gap-6 mb-6">
                <!-- Attendance chart with date range filter -->
                <div class="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                        <div>
                            <h2 class="font-heading font-semibold text-navy text-lg">Attendance</h2>
                            <p class="text-xs text-gray-400 mt-0.5">{{ attendanceLogs.length }} total check-ins</p>
                        </div>
                        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                            <button
                                v-for="opt in dateRangeOptions"
                                :key="opt.value"
                                class="px-2.5 py-1 rounded text-[11px] font-medium transition-all"
                                :class="dateRange === opt.value ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="dateRange = opt.value"
                            >
                                {{ opt.label }}
                            </button>
                        </div>
                    </div>
                    <div class="h-60">
                        <Bar :data="attendanceChartData" :options="barOptions" />
                    </div>
                </div>

                <!-- Member status breakdown -->
                <div class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                    <h2 class="font-heading font-semibold text-navy text-lg mb-1">Member Status</h2>
                    <p class="text-xs text-gray-400 mb-4">Distribution overview</p>
                    <div class="h-56">
                        <Doughnut :data="statusChartData" :options="doughnutOptions" />
                    </div>
                </div>
            </div>

            <!-- Church member counts -->
            <div class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                <div class="flex items-center justify-between mb-5">
                    <div>
                        <h2 class="font-heading font-semibold text-navy text-lg">Members by Church</h2>
                        <p class="text-xs text-gray-400 mt-0.5">{{ churches.length }} satellite church{{ churches.length !== 1 ? 'es' : '' }}</p>
                    </div>
                    <div class="w-10 h-10 rounded-lg bg-navy/6 flex items-center justify-center">
                        <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                    </div>
                </div>
                <div v-if="!churches.length" class="text-sm text-gray-400 text-center py-8">
                    <svg class="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                    </svg>
                    No church data
                </div>
                <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <div
                        v-for="c in churches"
                        :key="c.id"
                        class="flex items-center gap-4 p-3 bg-gray-50/80 rounded-lg border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all duration-200"
                    >
                        <div class="w-10 h-10 rounded-lg bg-navy/6 flex items-center justify-center shrink-0">
                            <svg class="w-4.5 h-4.5 text-navy/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                            </svg>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-700 truncate">{{ c.church_name }}</p>
                            <p class="text-xs text-gray-400">members</p>
                        </div>
                        <span class="text-xl font-heading font-bold text-navy">{{ c.count }}</span>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
