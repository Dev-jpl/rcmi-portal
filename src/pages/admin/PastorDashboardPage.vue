<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()

// Current pastor's user_id — for pastoral role, scope to self; for super_admin/admin, allow picking
const currentUserId = computed(() => auth.user?.id ?? '')
const isScopedView = computed(() => auth.isPastor && !auth.isAdmin)

interface NetworkLeader {
    id: number; user_id: string; pastor_id: string | null; pastor_name: string | null
    church_id: number | null; date_started: string | null; is_active: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}
interface LpathLeader {
    id: number; user_id: string; network_id: number | null; network_name: string | null
    church_id: number | null; date_started: string | null; is_active: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}
interface LpathMember {
    id: number; user_id: string; lpath_leader_id: string | null; lpath_leader_name: string | null
    network_leader_id: number | null; network_leader_name: string | null
    church_id: number | null; date_started: string | null; is_active: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}
interface Church { id: number; church_name: string }
interface PastorOption { id: number; user_id: string; user?: { first_name: string | null; last_name: string | null } }

const activeTab = ref<'network' | 'lpath-leaders' | 'lpath-members'>('network')
const loading = ref(true)
const search = ref('')

const networkLeaders = ref<NetworkLeader[]>([])
const lpathLeaders = ref<LpathLeader[]>([])
const lpathMembers = ref<LpathMember[]>([])
const churches = ref<Church[]>([])
const pastors = ref<PastorOption[]>([])
const selectedPastorId = ref('')

onMounted(async () => {
    if (!isScopedView.value) {
        await fetchPastors()
    }
    await fetchChurches()
    // For scoped view, set pastor to current user
    if (isScopedView.value) {
        selectedPastorId.value = currentUserId.value
    } else if (pastors.value.length) {
        selectedPastorId.value = pastors.value[0].user_id
    }
    await fetchAll()
    loading.value = false
})

watch(selectedPastorId, async () => {
    if (selectedPastorId.value) {
        loading.value = true
        await fetchAll()
        loading.value = false
    }
})

async function fetchPastors() {
    const { data } = await supabase
        .from('tbl_pastoral_members')
        .select('id, user_id, user:tbl_users!tbl_pastoral_members_user_id_fkey(first_name, last_name)')
        .eq('is_active', 'Y')
    pastors.value = (data as PastorOption[]) ?? []
}

async function fetchChurches() {
    const { data } = await supabase.from('lib_satellite_churches').select('id, church_name').eq('is_active', true).order('church_name')
    churches.value = data ?? []
}

async function fetchAll() {
    await Promise.all([fetchNetworkLeaders(), fetchLpathLeaders(), fetchLpathMembers()])
}

async function fetchNetworkLeaders() {
    if (!selectedPastorId.value) return
    const { data } = await supabase
        .from('tbl_network_leaders')
        .select('*, user:tbl_users!tbl_network_leaders_user_id_fkey(id, first_name, last_name, email)')
        .eq('pastor_id', selectedPastorId.value)
        .order('created_at', { ascending: false })
    networkLeaders.value = (data as NetworkLeader[]) ?? []
}

async function fetchLpathLeaders() {
    if (!selectedPastorId.value) return
    // L-Path leaders are under network leaders who are under this pastor
    const networkIds = networkLeaders.value.map(n => n.id)
    if (!networkIds.length) { lpathLeaders.value = []; return }
    const { data } = await supabase
        .from('tbl_lpath_leaders')
        .select('*, user:tbl_users!tbl_lpath_leaders_user_id_fkey(id, first_name, last_name, email)')
        .in('network_id', networkIds)
        .order('created_at', { ascending: false })
    lpathLeaders.value = (data as LpathLeader[]) ?? []
}

async function fetchLpathMembers() {
    if (!selectedPastorId.value) return
    const networkIds = networkLeaders.value.map(n => n.id)
    if (!networkIds.length) { lpathMembers.value = []; return }
    const { data } = await supabase
        .from('tbl_lpath_members')
        .select('*, user:tbl_users!tbl_lpath_members_user_id_fkey(id, first_name, last_name, email)')
        .in('network_leader_id', networkIds)
        .order('created_at', { ascending: false })
    lpathMembers.value = (data as LpathMember[]) ?? []
}

// Need to refetch lpath after network leaders loaded
watch(networkLeaders, async () => {
    await Promise.all([fetchLpathLeaders(), fetchLpathMembers()])
}, { flush: 'post' })

const filteredNetwork = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return networkLeaders.value
    return networkLeaders.value.filter(m => {
        const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || m.user?.email?.toLowerCase().includes(q)
    })
})

const filteredLpathLeaders = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return lpathLeaders.value
    return lpathLeaders.value.filter(m => {
        const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || m.user?.email?.toLowerCase().includes(q)
    })
})

const filteredLpathMembers = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return lpathMembers.value
    return lpathMembers.value.filter(m => {
        const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || m.user?.email?.toLowerCase().includes(q)
    })
})

function displayName(u?: { first_name: string | null; last_name: string | null }) {
    if (!u) return '—'
    return [u.first_name, u.last_name].filter(Boolean).join(' ')
}

function churchName(id: number | null) {
    if (!id) return '—'
    return churches.value.find(c => c.id === id)?.church_name ?? '—'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pastorDisplayName(p: PastorOption) {
    return [p.user?.first_name, p.user?.last_name].filter(Boolean).join(' ')
}

const tabs = [
    { key: 'network' as const, label: 'Network Leaders', count: () => networkLeaders.value.length },
    { key: 'lpath-leaders' as const, label: 'L-Path Leaders', count: () => lpathLeaders.value.length },
    { key: 'lpath-members' as const, label: 'L-Path Members', count: () => lpathMembers.value.length },
]
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Network Management</h1>
                <p class="text-sm text-gray-500 mt-1">Manage your network leaders, L-Path leaders, and L-Path members</p>
            </div>
            <!-- Pastor selector for admins -->
            <select
                v-if="!isScopedView && pastors.length"
                v-model="selectedPastorId"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
                <option v-for="p in pastors" :key="p.user_id" :value="p.user_id">
                    {{ pastorDisplayName(p) }}
                </option>
            </select>
        </div>

        <!-- Stats cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-sm text-gray-500">Network Leaders</p>
                <p class="text-2xl font-bold text-navy mt-1">{{ networkLeaders.filter(n => n.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-sm text-gray-500">L-Path Leaders</p>
                <p class="text-2xl font-bold text-navy mt-1">{{ lpathLeaders.filter(l => l.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-sm text-gray-500">L-Path Members</p>
                <p class="text-2xl font-bold text-navy mt-1">{{ lpathMembers.filter(m => m.is_active === 'Y').length }}</p>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 overflow-x-auto">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
                <span class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === tab.key ? 'bg-navy/10 text-navy' : 'bg-gray-200 text-gray-500'">
                    {{ tab.count() }}
                </span>
            </button>
        </div>

        <!-- Search -->
        <div class="mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search by name or email..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Network Leaders Tab -->
        <template v-else-if="activeTab === 'network'">
            <div v-if="!filteredNetwork.length" class="text-center py-12 text-gray-400">No network leaders found.</div>
            <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Email</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Church</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Started</th>
                                <th class="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="m in filteredNetwork" :key="m.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                                            {{ (m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '') }}
                                        </div>
                                        <span class="font-medium text-gray-900">{{ displayName(m.user) }}</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.user?.email ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ churchName(m.church_id) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(m.date_started) }}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                                        {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- L-Path Leaders Tab -->
        <template v-else-if="activeTab === 'lpath-leaders'">
            <div v-if="!filteredLpathLeaders.length" class="text-center py-12 text-gray-400">No L-Path leaders found.</div>
            <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Email</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Network Leader</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Church</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Started</th>
                                <th class="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="m in filteredLpathLeaders" :key="m.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                                            {{ (m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '') }}
                                        </div>
                                        <span class="font-medium text-gray-900">{{ displayName(m.user) }}</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.user?.email ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.network_name ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ churchName(m.church_id) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(m.date_started) }}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                                        {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- L-Path Members Tab -->
        <template v-else-if="activeTab === 'lpath-members'">
            <div v-if="!filteredLpathMembers.length" class="text-center py-12 text-gray-400">No L-Path members found.</div>
            <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Email</th>
                                <th class="px-4 py-3 hidden lg:table-cell">L-Path Leader</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Network Leader</th>
                                <th class="px-4 py-3 hidden xl:table-cell">Church</th>
                                <th class="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="m in filteredLpathMembers" :key="m.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                                            {{ (m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '') }}
                                        </div>
                                        <span class="font-medium text-gray-900">{{ displayName(m.user) }}</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.user?.email ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.lpath_leader_name ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.network_leader_name ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden xl:table-cell">{{ churchName(m.church_id) }}</td>
                                <td class="px-4 py-3">
                                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                                        {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>
