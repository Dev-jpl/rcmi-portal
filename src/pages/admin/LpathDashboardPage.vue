<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import LeadershipGraph from '@/components/common/LeadershipGraph.vue'
import type { Node, Edge } from '@vue-flow/core'

const auth = useAuthStore()
const admin = useAdminStore()
const currentUserId = computed(() => auth.user?.id ?? '')
const isScopedView = computed(() => auth.isLpathLeader && !auth.isAdmin)

interface LpathLeaderOption {
    id: number; user_id: string
    user?: { first_name: string | null; last_name: string | null }
}
interface LpathMember {
    id: number; user_id: string; lpath_leader_id: string | null; lpath_leader_name: string | null
    network_leader_id: number | null; network_leader_name: string | null
    church_id: number | null; date_started: string | null; is_active: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}
interface Church { id: number; church_name: string }

interface MemberProfile {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo_url: string | null
    status?: string | null
    satellite_church_id?: number | null
}

const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const lpathLeadersList = ref<LpathLeaderOption[]>([])
const selectedLeaderUserId = ref('')
const selectedLeaderId = ref<number | null>(null) // the tbl_lpath_leaders.id
const members = ref<LpathMember[]>([])
const churches = ref<Church[]>([])

// Assign modal
const showAssignModal = ref(false)
const assignSaving = ref(false)
const memberSearch = ref('')
const showMemberDropdown = ref(false)
// allMembers replaced by admin.members
const assignForm = ref({ user_id: '', date_started: new Date().toISOString().split('T')[0] })

onMounted(async () => {
    await Promise.all([fetchChurches(), admin.fetchMembers()])
    if (isScopedView.value) {
        selectedLeaderUserId.value = currentUserId.value
        // Get the leader record id
        const { data } = await supabase
            .from('tbl_lpath_leaders')
            .select('id, network_id')
            .eq('user_id', currentUserId.value)
            .eq('is_active', 'Y')
            .maybeSingle()
        if (data) selectedLeaderId.value = data.id
    } else {
        const { data } = await supabase
            .from('tbl_lpath_leaders')
            .select('id, user_id, user:tbl_users!tbl_lpath_leaders_user_id_fkey(first_name, last_name)')
            .eq('is_active', 'Y')
        lpathLeadersList.value = (data as LpathLeaderOption[]) ?? []
        if (lpathLeadersList.value.length > 0) {
            selectedLeaderUserId.value = lpathLeadersList.value[0]?.user_id ?? ''
            selectedLeaderId.value = lpathLeadersList.value[0]?.id ?? null
        }
    }
    await fetchMembers()
    loading.value = false
})

// fetchAllMembers no longer needed

function openAssignModal() {
    assignForm.value = { user_id: '', date_started: new Date().toISOString().split('T')[0] }
    memberSearch.value = ''
    showMemberDropdown.value = false
    showAssignModal.value = true
}

const availableMembers = computed(() => {
    const q = memberSearch.value.toLowerCase()
    const existingIds = new Set(members.value.map(m => m.user_id))
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
    if (!assignForm.value.user_id || !selectedLeaderUserId.value) return
    assignSaving.value = true
    message.value = null

    const member = (admin.members as MemberProfile[]).find(m => m.user_id === assignForm.value.user_id)
    const leader = lpathLeadersList.value.find(l => l.user_id === selectedLeaderUserId.value)
    const leaderName = leader ? displayName(leader.user) : (auth.user ? displayName(auth.user) : null)

    // Get the network_leader_id from the lpath leader record
    let networkLeaderId: number | null = null
    let networkLeaderName: string | null = null
    if (selectedLeaderId.value) {
        const { data: llRecord } = await supabase
            .from('tbl_lpath_leaders')
            .select('network_id, network_name')
            .eq('id', selectedLeaderId.value)
            .maybeSingle()
        if (llRecord) {
            networkLeaderId = llRecord.network_id
            networkLeaderName = llRecord.network_name
        }
    }

    const { error } = await supabase.from('tbl_lpath_members').insert({
        user_id: assignForm.value.user_id,
        lpath_leader_id: selectedLeaderUserId.value,
        lpath_leader_name: leaderName,
        network_leader_id: networkLeaderId,
        network_leader_name: networkLeaderName,
        church_id: member?.satellite_church_id ?? null,
        date_started: assignForm.value.date_started || null,
        is_active: 'Y',
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `${member?.first_name} ${member?.last_name} assigned as L-Path Member.` }
        showAssignModal.value = false
        await fetchMembers()
    }
    assignSaving.value = false
}

watch(selectedLeaderUserId, async () => {
    if (selectedLeaderUserId.value) {
        // Update selectedLeaderId
        const ll = lpathLeadersList.value.find(l => l.user_id === selectedLeaderUserId.value)
        selectedLeaderId.value = (ll as any)?.id ?? null
        loading.value = true
        await fetchMembers()
        loading.value = false
    }
})

async function fetchChurches() {
    const { data } = await supabase.from('lib_satellite_churches').select('id, church_name').eq('is_active', true).order('church_name')
    churches.value = data ?? []
}

async function fetchMembers() {
    if (!selectedLeaderUserId.value) return
    const { data } = await supabase
        .from('tbl_lpath_members')
        .select('*, user:tbl_users!tbl_lpath_members_user_id_fkey(id, first_name, last_name, email)')
        .eq('lpath_leader_id', selectedLeaderUserId.value)
        .order('created_at', { ascending: false })
    members.value = (data as LpathMember[]) ?? []
}

const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return members.value
    return members.value.filter(m => {
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

const activeTab = ref<'members' | 'hierarchy'>('members')

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Hierarchy graph
const graphNodes = computed<Node[]>(() => {
    const nodes: Node[] = []
    const ll = lpathLeadersList.value.find(l => l.user_id === selectedLeaderUserId.value)
    const llName = ll ? displayName(ll.user) : (auth.user ? displayName(auth.user) : 'L-Path Leader')
    nodes.push({ id: `ll-${selectedLeaderUserId.value}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: llName, role: 'L-Path Leader', active: true } })
    for (const m of members.value) {
        nodes.push({ id: `m-${m.id}`, type: 'leadership', position: { x: 0, y: 0 }, data: { name: displayName(m.user), role: 'Member', active: m.is_active === 'Y' } })
    }
    return nodes
})

const graphEdges = computed<Edge[]>(() => {
    return members.value.map(m => ({
        id: `e-ll-m-${m.id}`,
        source: `ll-${selectedLeaderUserId.value}`,
        target: `m-${m.id}`,
    }))
})
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">My L-Path</h1>
                <p class="text-sm text-gray-500 mt-1">Manage your L-Path members</p>
            </div>
            <div class="flex items-center gap-3">
                <button
                    v-if="activeTab === 'members'"
                    class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                    @click="openAssignModal"
                >
                    + Assign Member
                </button>
                <select
                    v-if="!isScopedView && lpathLeadersList.length"
                    v-model="selectedLeaderUserId"
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                    <option v-for="l in lpathLeadersList" :key="l.user_id" :value="l.user_id">
                        {{ displayName(l.user) }}
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

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Active Members</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ members.filter(m => m.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">Total Members</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ members.length }}</p>
            </div>
        </div>

        <!-- Tabs -->
        <div class="inline-flex max-w-full gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-4 overflow-x-auto">
            <button
                v-for="tab in [{ key: 'members' as const, label: 'Members' }, { key: 'hierarchy' as const, label: 'Hierarchy' }]"
                :key="tab.key"
                class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
                <span v-if="tab.key === 'members'" class="ml-1 text-[10px] tabular-nums" :class="activeTab === tab.key ? 'text-navy/50' : 'text-gray-300'">
                    {{ members.length }}
                </span>
            </button>
        </div>

        <!-- Members Tab -->
        <template v-if="activeTab === 'members'">
        <!-- Search -->
        <div class="mb-4">
            <input v-model="search" type="text" placeholder="Search by name or email..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
        </div>

        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No L-Path members found.</div>

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
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="m in filtered" :key="m.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
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

        <!-- Hierarchy Tab -->
        <template v-else-if="activeTab === 'hierarchy'">
            <LeadershipGraph :nodes="graphNodes" :edges="graphEdges" />
        </template>

        <!-- Assign Member Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showAssignModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showAssignModal = false" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div class="flex items-center justify-between mb-5">
                            <h3 class="font-heading font-semibold text-navy text-lg">Assign Member</h3>
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
                                {{ assignSaving ? 'Assigning...' : 'Assign Member' }}
                            </button>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
