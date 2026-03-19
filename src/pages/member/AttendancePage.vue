<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAttendanceStore } from '@/stores/attendance.store'

const attendance = useAttendanceStore()

const activeTab = ref<'service' | 'events' | 'lpath'>('service')
const search = ref('')

onMounted(() => {
    attendance.fetchMyLogs()
})

const tabs = [
    { key: 'service' as const, label: 'Service' },
    { key: 'events' as const, label: 'Events' },
    { key: 'lpath' as const, label: 'L-Path' },
]

const filtered = computed(() => {
    let logs = attendance.logs

    // Filter by tab (event_type based)
    if (activeTab.value === 'service') {
        logs = logs.filter((l) => !l.event_title || l.event_title.toLowerCase().includes('service') || l.event_title.toLowerCase().includes('worship') || !l.event_title.toLowerCase().includes('lpath'))
    } else if (activeTab.value === 'lpath') {
        logs = logs.filter((l) => l.event_title?.toLowerCase().includes('lpath') || l.event_title?.toLowerCase().includes('learning'))
    }

    // Search filter
    const q = search.value.toLowerCase()
    if (q) {
        logs = logs.filter(
            (l) =>
                l.event_title?.toLowerCase().includes(q) ||
                l.logged_location_name?.toLowerCase().includes(q) ||
                l.remarks?.toLowerCase().includes(q),
        )
    }

    return logs
})

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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 class="text-2xl font-heading font-bold text-navy">My Attendance</h1>
            <router-link
                :to="{ name: 'member-checkin' }"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Self Check-In
            </router-link>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
                :class="activeTab === tab.key
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- Search -->
        <div class="mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search by event, location, or remarks..."
                class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Loading -->
        <div v-if="attendance.loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-12">
            <p class="text-gray-400">{{ search ? 'No matching records.' : 'No attendance records yet.' }}</p>
        </div>

        <!-- Table -->
        <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Date</th>
                            <th class="px-4 py-3">Time</th>
                            <th class="px-4 py-3">Event</th>
                            <th class="px-4 py-3 hidden md:table-cell">Location</th>
                            <th class="px-4 py-3 hidden md:table-cell">Method</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Remarks</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="log in filtered" :key="log.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3 text-gray-900">{{ formatDate(log.log_date) }}</td>
                            <td class="px-4 py-3 text-gray-500">{{ formatTime(log.logged_at) }}</td>
                            <td class="px-4 py-3 font-medium text-gray-900">{{ log.event_title ?? '—' }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_location_name ?? '—' }}</td>
                            <td class="px-4 py-3 hidden md:table-cell">
                                <span
                                    class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="{
                                        'bg-blue-100 text-blue-700': log.input_method === 'QR',
                                        'bg-green-100 text-green-700': log.input_method === 'self',
                                        'bg-gray-100 text-gray-600': log.input_method === 'manual',
                                    }"
                                >
                                    {{ log.input_method }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{{ log.remarks ?? '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
