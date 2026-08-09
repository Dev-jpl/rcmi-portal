<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import LeadershipGraph from '@/components/common/LeadershipGraph.vue'
import type { Node, Edge } from '@vue-flow/core'

const auth = useAuthStore()
const admin = useAdminStore()

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

interface MemberProfile {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo_url: string | null
    status?: string | null
    satellite_church_id?: number | null
}

const activeTab = ref<'network' | 'lpath-leaders' | 'lpath-members' | 'hierarchy'>('network')
const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
type RemoveTarget = {
    id: number
    kind: 'network' | 'lpath-leader' | 'lpath-member'
    label: string
    user?: { first_name: string | null; last_name: string | null }
}
const showRemoveModal = ref(false)
const removeTarget = ref<RemoveTarget | null>(null)
const removing = ref(false)

const networkLeaders = ref<NetworkLeader[]>([])
const lpathLeaders = ref<LpathLeader[]>([])
const lpathMembers = ref<LpathMember[]>([])
const churches = ref<Church[]>([])
const pastors = ref<PastorOption[]>([])
const selectedPastorId = ref('')

// Assign modal
const showAssignModal = ref(false)
const assignSaving = ref(false)
const memberSearch = ref('')
const showMemberDropdown = ref(false)
// allMembers replaced by admin.members
const assignForm = ref({ user_id: '', date_started: new Date().toISOString().split('T')[0] })

onMounted(async () => {
    if (!isScopedView.value) {
        await fetchPastors()
    }
    await Promise.all([fetchChurches(), admin.fetchMembers()])
    if (isScopedView.value) {
        selectedPastorId.value = currentUserId.value
    } else if (pastors.value.length > 0) {
        selectedPastorId.value = pastors.value[0]?.user_id ?? ''
    }
    await fetchAll()
    loading.value = false
})

// fetchAllMembers no longer needed

function openAssignModal() {
    assignForm.value = { user_id: '', date_started: new Date().toISOString().split('T')[0] }
    memberSearch.value = ''
    showMemberDropdown.value = false
    showAssignModal.value = true
}

// Compute available members (not already assigned as network leaders under this pastor)
const availableMembers = computed(() => {
    const q = memberSearch.value.toLowerCase()
    const existingIds = new Set(networkLeaders.value.map(n => n.user_id))
    const approved = (admin.members as MemberProfile[]).filter((m: MemberProfile) => m.status === 'approved' && !existingIds.has(m.user_id))

    if (!q) return approved.slice(0, 15)
    return approved
        .filter((m: MemberProfile) =>
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

function selectMember(m: MemberProfile) {
    assignForm.value.user_id = m.user_id
    memberSearch.value = `${m.first_name} ${m.last_name}`
    showMemberDropdown.value = false
}

function hideMemberDropdown() {
    setTimeout(() => { showMemberDropdown.value = false }, 200)
}

async function handleAssign() {
    if (!assignForm.value.user_id || !selectedPastorId.value) return
    assignSaving.value = true
    message.value = null

    const member = (admin.members as MemberProfile[]).find(m => m.user_id === assignForm.value.user_id)
    const pastor = pastors.value.find(p => p.user_id === selectedPastorId.value)
    const pastorName = pastor ? pastorDisplayName(pastor) : (auth.user ? displayName(auth.user) : null)

    const { error } = await supabase.from('tbl_network_leaders').insert({
        user_id: assignForm.value.user_id,
        pastor_id: selectedPastorId.value,
        pastor_name: pastorName,
        church_id: member?.satellite_church_id ?? null,
        date_started: assignForm.value.date_started || null,
        is_active: 'Y',
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${member?.first_name} ${member?.last_name} assigned as Network Leader.` }
        showAssignModal.value = false
        await fetchAll()
    }
    assignSaving.value = false
}

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

function openRemove(target: RemoveTarget) {
    removeTarget.value = target
    showRemoveModal.value = true
}

async function handleRemove() {
    const target = removeTarget.value
    if (!target) return
    removing.value = true
    message.value = null

    const result = target.kind === 'network'
        ? await supabase.from('tbl_network_leaders').delete().eq('id', target.id)
        : target.kind === 'lpath-leader'
            ? await supabase.from('tbl_lpath_leaders').delete().eq('id', target.id)
            : await supabase.from('tbl_lpath_members').delete().eq('id', target.id)

    if (result.error) {
        message.value = { type: 'error', text: `Unable to remove ${target.label.toLowerCase()}: ${result.error.message}` }
    } else {
        message.value = { type: 'success', text: `${target.label} assignment removed.` }
        await fetchAll()
    }
    removing.value = false
    showRemoveModal.value = false
    removeTarget.value = null
}

function pastorDisplayName(p: PastorOption) {
    return [p.user?.first_name, p.user?.last_name].filter(Boolean).join(' ')
}

// Hierarchy graph
const graphNodes = computed<Node[]>(() => {
    const nodes: Node[] = []
    const pastor = pastors.value.find(p => p.user_id === selectedPastorId.value)
    const pastorName = pastor ? pastorDisplayName(pastor) : (auth.user ? displayName(auth.user) : 'Pastor')
    nodes.push({ id: `pastor-${selectedPastorId.value}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: pastorName, role: 'Pastor', active: true } })
    for (const nl of networkLeaders.value) {
        nodes.push({ id: `nl-${nl.id}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: displayName(nl.user), role: 'Network Leader', active: nl.is_active === 'Y' } })
    }
    for (const ll of lpathLeaders.value) {
        nodes.push({ id: `ll-${ll.id}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: displayName(ll.user), role: 'L-Path Leader', active: ll.is_active === 'Y' } })
    }
    for (const m of lpathMembers.value) {
        nodes.push({ id: `m-${m.id}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: displayName(m.user), role: 'Member', active: m.is_active === 'Y' } })
    }
    return nodes
})

const graphEdges = computed<Edge[]>(() => {
    const edges: Edge[] = []
    for (const nl of networkLeaders.value) {
        edges.push({ id: `e-pastor-nl-${nl.id}`, source: `pastor-${selectedPastorId.value}`, target: `nl-${nl.id}` })
    }
    for (const ll of lpathLeaders.value) {
        if (ll.network_id != null) {
            edges.push({ id: `e-nl-ll-${ll.id}`, source: `nl-${ll.network_id}`, target: `ll-${ll.id}` })
        }
    }
    for (const m of lpathMembers.value) {
        // Link to lpath leader if available, else to network leader
        const llMatch = lpathLeaders.value.find(ll => ll.user_id === m.lpath_leader_id)
        if (llMatch) {
            edges.push({ id: `e-ll-m-${m.id}`, source: `ll-${llMatch.id}`, target: `m-${m.id}` })
        } else if (m.network_leader_id != null) {
            edges.push({ id: `e-nl-m-${m.id}`, source: `nl-${m.network_leader_id}`, target: `m-${m.id}` })
        }
    }
    return edges
})

const tabs = [
    { key: 'network' as const, label: 'Network Leaders', count: () => networkLeaders.value.length },
    { key: 'lpath-leaders' as const, label: 'L-Path Leaders', count: () => lpathLeaders.value.length },
    { key: 'lpath-members' as const, label: 'L-Path Members', count: () => lpathMembers.value.length },
    { key: 'hierarchy' as const, label: 'Hierarchy', count: () => null },
]
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Network Management</h1>
                <p class="text-sm text-gray-500 mt-1">Manage your network leaders, L-Path leaders, and L-Path members</p>
            </div>
            <div class="flex items-center gap-3">
                <button
                    v-if="activeTab === 'network'"
                    class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                    @click="openAssignModal"
                >
                    + Assign Network Leader
                </button>
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
        </div>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <!-- Stats cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Network Leaders</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ networkLeaders.filter(n => n.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">L-Path Leaders</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ lpathLeaders.filter(l => l.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">L-Path Members</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ lpathMembers.filter(m => m.is_active === 'Y').length }}</p>
            </div>
        </div>

        <!-- Tabs -->
        <div class="inline-flex max-w-full gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-4 overflow-x-auto">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
                <span v-if="tab.count() !== null" class="ml-1 text-[10px] tabular-nums" :class="activeTab === tab.key ? 'text-navy/50' : 'text-gray-300'">
                    {{ tab.count() }}
                </span>
            </button>
        </div>

        <!-- Search -->
        <div v-if="activeTab !== 'hierarchy'" class="mb-4">
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
            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Email</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Church</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Started</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
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
                                <td class="px-4 py-3 text-right">
                                    <button class="text-red-600 hover:text-red-700 text-sm font-medium" @click="openRemove({ id: m.id, kind: 'network', label: 'Network leader', user: m.user })">Remove</button>
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
            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                                <th class="px-4 py-3 text-right">Actions</th>
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
                                <td class="px-4 py-3 text-right">
                                    <button class="text-red-600 hover:text-red-700 text-sm font-medium" @click="openRemove({ id: m.id, kind: 'lpath-leader', label: 'L-Path leader', user: m.user })">Remove</button>
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
            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                                <th class="px-4 py-3 text-right">Actions</th>
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
                                <td class="px-4 py-3 text-right">
                                    <button class="text-red-600 hover:text-red-700 text-sm font-medium" @click="openRemove({ id: m.id, kind: 'lpath-member', label: 'L-Path member', user: m.user })">Remove</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Hierarchy Tab -->
        <template v-else-if="activeTab === 'hierarchy'">
            <LeadershipGraph :nodes="graphNodes" :edges="graphEdges" />
        </template>

        <!-- Assign Network Leader Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showAssignModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showAssignModal = false" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div class="flex items-center justify-between mb-5">
                            <h3 class="font-heading font-semibold text-navy text-lg">Assign Network Leader</h3>
                            <button class="text-gray-400 hover:text-gray-600" @click="showAssignModal = false">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form @submit.prevent="handleAssign" class="space-y-4">
                            <div class="relative">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                                <input
                                    v-model="memberSearch"
                                    type="text"
                                    placeholder="Search members..."
                                    @focus="showMemberDropdown = true"
                                    @blur="hideMemberDropdown"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />

                                <!-- Search Dropdown -->
                                <div
                                    v-if="showMemberDropdown"
                                    class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                >
                                    <div
                                        v-for="m in availableMembers"
                                        :key="m.user_id"
                                        @mousedown="selectMember(m)"
                                        class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                        <div class="w-8 h-8 rounded-full overflow-hidden bg-navy/5 flex items-center justify-center shrink-0">
                                            <img v-if="m.profile_photo_url" :src="m.profile_photo_url" class="w-full h-full object-cover" />
                                            <span v-else class="text-[10px] font-bold text-navy">
                                                {{ m.first_name?.[0] }}{{ m.last_name?.[0] }}
                                            </span>
                                        </div>
                                        <div class="min-w-0">
                                            <p class="text-xs font-semibold text-gray-900 truncate">{{ m.first_name }} {{ m.last_name }}</p>
                                            <p class="text-[10px] text-gray-400 truncate">{{ m.email }}</p>
                                        </div>
                                    </div>
                                    <div v-if="!availableMembers.length" class="px-3 py-4 text-center text-xs text-gray-400">
                                        No members found.
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Date Started</label>
                                <input
                                    v-model="assignForm.date_started"
                                    type="date"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                            <button
                                type="submit"
                                :disabled="assignSaving"
                                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                            >
                                {{ assignSaving ? 'Assigning...' : 'Assign as Network Leader' }}
                            </button>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <Teleport to="body">
            <div v-if="showRemoveModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showRemoveModal = false">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-gray-900 mb-2">Remove {{ removeTarget?.label }}</h3>
                    <p class="text-sm text-gray-600">Remove <strong>{{ displayName(removeTarget?.user) }}</strong> from this leadership assignment? Their member account and profile will remain.</p>
                    <div class="flex justify-end gap-3 mt-6">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showRemoveModal = false">Cancel</button>
                        <button :disabled="removing" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50" @click="handleRemove">{{ removing ? 'Removing...' : 'Remove' }}</button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
