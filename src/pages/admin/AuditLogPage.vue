<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuditStore } from '@/stores/audit.store'

const store = useAuditStore()
const filterAction = ref('')
const filterEntity = ref('')
const page = ref(0)
const pageSize = 30

const actionOptions = ['approve_member', 'reject_member', 'create_event', 'update_event', 'create_announcement', 'delete_announcement', 'manual_checkin']
const entityOptions = ['member', 'event', 'announcement', 'attendance']

async function load() {
    await store.fetchEntries({
        action: filterAction.value || undefined,
        entity_type: filterEntity.value || undefined,
        limit: pageSize,
        offset: page.value * pageSize,
    })
}

function applyFilters() {
    page.value = 0
    load()
}

function nextPage() {
    page.value++
    load()
}

function prevPage() {
    if (page.value > 0) {
        page.value--
        load()
    }
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function actionColor(action: string) {
    if (action.includes('approve')) return 'bg-green-100 text-green-700'
    if (action.includes('reject') || action.includes('delete')) return 'bg-red-100 text-red-600'
    if (action.includes('create')) return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
}

onMounted(load)
</script>

<template>
    <div>
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Audit Log</h1>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-6">
            <select
                v-model="filterAction"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                @change="applyFilters"
            >
                <option value="">All Actions</option>
                <option v-for="a in actionOptions" :key="a" :value="a">{{ a.replace(/_/g, ' ') }}</option>
            </select>
            <select
                v-model="filterEntity"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                @change="applyFilters"
            >
                <option value="">All Entities</option>
                <option v-for="e in entityOptions" :key="e" :value="e">{{ e }}</option>
            </select>
        </div>

        <div v-if="store.loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-12 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="store.entries.length === 0" class="text-center py-12 text-gray-400">
            No audit entries found.
        </div>

        <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Timestamp</th>
                            <th class="px-4 py-3">User</th>
                            <th class="px-4 py-3">Action</th>
                            <th class="px-4 py-3">Entity</th>
                            <th class="px-4 py-3 hidden md:table-cell">Details</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="entry in store.entries" :key="entry.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{{ formatDate(entry.created_at) }}</td>
                            <td class="px-4 py-3 font-medium text-gray-800">{{ entry.user_name }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                    :class="actionColor(entry.action)"
                                >
                                    {{ entry.action.replace(/_/g, ' ') }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-gray-600 capitalize">{{ entry.entity_type }}</td>
                            <td class="px-4 py-3 text-xs text-gray-400 hidden md:table-cell max-w-xs truncate">{{ entry.details ?? '—' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Pagination -->
        <div v-if="store.totalCount > pageSize" class="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>{{ page * pageSize + 1 }}–{{ Math.min((page + 1) * pageSize, store.totalCount) }} of {{ store.totalCount }}</span>
            <div class="flex gap-1">
                <button class="px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40" :disabled="page === 0" @click="prevPage">Prev</button>
                <button class="px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40" :disabled="(page + 1) * pageSize >= store.totalCount" @click="nextPage">Next</button>
            </div>
        </div>
    </div>
</template>
