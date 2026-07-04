<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'
import * as XLSX from 'xlsx'
import type { Tables } from '@/types/database.types'

type AttendanceLog = Tables<'tbl_attendance_logs'>

const admin = useAdminStore()

const logs = ref<AttendanceLog[]>([])
const loading = ref(true)
const churches = ref<{ id: number; church_name: string }[]>([])

// Each member's leadership chain (Pastor → Network Leader → L-Path Leader),
// keyed by user_id, sourced from tbl_lpath_members.
interface Hierarchy { pastor: string | null; network: string | null; lpath: string | null }
const hierarchyMap = ref<Record<string, Hierarchy>>({})

// Filters
const dateFrom = ref('')
const dateTo = ref('')
const churchFilter = ref<number | null>(null)
const eventTypeFilter = ref('')

onMounted(async () => {
    // Default date range: last 30 days
    const now = new Date()
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    dateFrom.value = thirtyAgo.toISOString().split('T')[0]
    dateTo.value = now.toISOString().split('T')[0]

    await Promise.all([fetchLogs(), fetchChurches(), fetchHierarchy(), admin.fetchMembers()])
    loading.value = false
})

async function fetchHierarchy() {
    const { data } = await supabase
        .from('tbl_lpath_members')
        .select('user_id, pastor_name, network_leader_name, lpath_leader_name')
    const map: Record<string, Hierarchy> = {}
    for (const r of data ?? []) {
        map[r.user_id] = {
            pastor: r.pastor_name,
            network: r.network_leader_name,
            lpath: r.lpath_leader_name,
        }
    }
    hierarchyMap.value = map
}

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
}

async function fetchLogs() {
    loading.value = true

    let query = supabase
        .from('tbl_attendance_logs')
        .select('*')
        .order('log_date', { ascending: false })

    if (dateFrom.value) {
        query = query.gte('log_date', dateFrom.value)
    }
    if (dateTo.value) {
        query = query.lte('log_date', dateTo.value)
    }

    const churchScope = churchFilter.value ?? admin.getChurchScope()
    if (churchScope) {
        query = query.eq('logged_location_id', churchScope)
    }

    const { data } = await query
    logs.value = data ?? []
    loading.value = false
}

const filtered = computed(() => {
    let list = logs.value
    if (eventTypeFilter.value) {
        list = list.filter((l) => l.event_title?.toLowerCase().includes(eventTypeFilter.value.toLowerCase()))
    }
    return list
})

// Summary stats
const summary = computed(() => {
    const total = filtered.value.length
    const uniqueMembers = new Set(filtered.value.map((l) => l.user_id)).size
    const uniqueEvents = new Set(filtered.value.filter((l) => l.event_id).map((l) => l.event_id)).size

    const byMethod: Record<string, number> = {}
    for (const l of filtered.value) {
        byMethod[l.input_method] = (byMethod[l.input_method] ?? 0) + 1
    }

    const byLocation: Record<string, number> = {}
    for (const l of filtered.value) {
        const key = l.logged_location_name ?? 'Unknown'
        byLocation[key] = (byLocation[key] ?? 0) + 1
    }

    return { total, uniqueMembers, uniqueEvents, byMethod, byLocation }
})

function getPastor(userId: string | null) { return (userId && hierarchyMap.value[userId]?.pastor) || '—' }
function getNetworkLeader(userId: string | null) { return (userId && hierarchyMap.value[userId]?.network) || '—' }
function getLpathLeader(userId: string | null) { return (userId && hierarchyMap.value[userId]?.lpath) || '—' }

function exportToExcel() {
    const rows = filtered.value.map((l) => ({
        Date: l.log_date ?? '',
        Member: getMemberName(l.user_id),
        Pastor: getPastor(l.user_id),
        'Network Leader': getNetworkLeader(l.user_id),
        'L-Path Leader': getLpathLeader(l.user_id),
        Event: l.event_title ?? '',
        'Logged By': l.logged_by_name ?? '',
        Location: l.logged_location_name ?? '',
        Method: l.input_method ?? '',
        'Logged At': l.logged_at ? new Date(l.logged_at).toLocaleString() : '',
        Remarks: l.remarks ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance-report-${dateFrom.value}-to-${dateTo.value}.xlsx`)
}

function getMemberName(userId: string | null) {
    if (!userId) return '—'
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 class="text-2xl font-heading font-bold text-navy">Reports</h1>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                @click="exportToExcel"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
            </button>
        </div>

        <!-- Filter panel -->
        <div class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h2 class="font-heading font-semibold text-navy mb-3">Filters</h2>
            <div class="flex flex-wrap gap-3 items-end">
                <div>
                    <label class="block text-xs text-gray-500 mb-1">From</label>
                    <input
                        v-model="dateFrom"
                        type="date"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">To</label>
                    <input
                        v-model="dateTo"
                        type="date"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Church</label>
                    <select
                        v-model="churchFilter"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                    >
                        <option :value="null">All</option>
                        <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Event Type</label>
                    <input
                        v-model="eventTypeFilter"
                        type="text"
                        placeholder="e.g. Sunday"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 w-36"
                    />
                </div>
                <button
                    class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                    @click="fetchLogs"
                >
                    Apply
                </button>
            </div>
        </div>

        <!-- Summary cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-lg p-4 border border-gray-200">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Logs</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ summary.total }}</p>
            </div>
            <div class="bg-white rounded-lg p-4 border border-gray-200">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Unique Members</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ summary.uniqueMembers }}</p>
            </div>
            <div class="bg-white rounded-lg p-4 border border-gray-200">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Events Covered</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ summary.uniqueEvents }}</p>
            </div>
            <div class="bg-white rounded-lg p-4 border border-gray-200">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Methods</p>
                <div class="flex gap-2 mt-1">
                    <span
                        v-for="(count, method) in summary.byMethod"
                        :key="method"
                        class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                    >
                        {{ method }}: {{ count }}
                    </span>
                </div>
            </div>
        </div>

        <!-- By location breakdown -->
        <div v-if="Object.keys(summary.byLocation).length > 1" class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
            <h2 class="font-heading font-semibold text-navy mb-3">By Location</h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div
                    v-for="(count, loc) in summary.byLocation"
                    :key="loc"
                    class="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                    <span class="text-sm text-gray-700 truncate">{{ loc }}</span>
                    <span class="text-lg font-heading font-bold text-navy ml-2">{{ count }}</span>
                </div>
            </div>
        </div>

        <!-- Table -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No records for selected filters.</div>

        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Date</th>
                            <th class="px-4 py-3">Member</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Pastor</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Network Leader</th>
                            <th class="px-4 py-3 hidden lg:table-cell">L-Path Leader</th>
                            <th class="px-4 py-3">Event</th>
                            <th class="px-4 py-3 hidden md:table-cell">Logged By</th>
                            <th class="px-4 py-3 hidden md:table-cell">Location</th>
                            <th class="px-4 py-3">Method</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Remarks</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="log in filtered.slice(0, 100)" :key="log.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3 text-gray-900">{{ formatDate(log.log_date) }}</td>
                            <td class="px-4 py-3 font-medium text-gray-900">{{ getMemberName(log.user_id) }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ getPastor(log.user_id) }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ getNetworkLeader(log.user_id) }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ getLpathLeader(log.user_id) }}</td>
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
                            <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{{ log.remarks ?? '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-if="filtered.length > 100" class="text-xs text-gray-400 text-center py-2 border-t border-gray-100">
                Showing 100 of {{ filtered.length }} — export to see all
            </p>
        </div>
    </div>
</template>
