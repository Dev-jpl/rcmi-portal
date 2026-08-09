<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'

const admin = useAdminStore()

interface LpathMember {
    id: number
    user_id: string
    lpath_leader_id: string | null
    lpath_leader_name: string | null
    network_leader_id: number | null
    network_leader_name: string | null
    church_id: number | null
    date_started: string | null
    is_active: string | null
    created_at: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}

interface MemberProfile {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo_url: string | null
    status?: string | null
}

interface LpathLeaderOption { id: number; user_id: string; network_id: number | null; network_name: string | null; pastor_id: string | null; pastor_name: string | null; user?: { first_name: string | null; last_name: string | null } }
interface NetworkLeaderOption { id: number; user_id: string; pastor_id: string | null; pastor_name: string | null; user?: { first_name: string | null; last_name: string | null } }
interface Church { id: number; church_name: string }

const members = ref<LpathMember[]>([])
const lpathLeaders = ref<LpathLeaderOption[]>([])
const networkLeaders = ref<NetworkLeaderOption[]>([])
const churches = ref<Church[]>([])
const loading = ref(true)
const search = ref('')
const lpathFilter = ref('')
const networkFilter = ref<number | null>(null)
const showModal = ref(false)
const editingId = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const saving = ref(false)
const showRemoveModal = ref(false)
const removeTarget = ref<LpathMember | null>(null)
const removing = ref(false)

const form = ref({
    user_id: '',
    lpath_leader_id: '',
    network_leader_id: null as number | null,
    church_id: null as number | null,
    date_started: new Date().toISOString().split('T')[0],
    is_active: 'Y',
})

// Member search for enrollment
const memberSearch = ref('')
const showMemberDropdown = ref(false)
const lpathLeaderSearch = ref('')
const showLpathDropdown = ref(false)
const networkLeaderSearch = ref('')
const showNetworkDropdown = ref(false)
const availableUsers = computed(() => {
    const q = memberSearch.value.toLowerCase()
    const existingIds = new Set(members.value.filter(m => m.is_active === 'Y' && m.id !== editingId.value).map(m => m.user_id))
    const approved = (admin.members as MemberProfile[]).filter((m: MemberProfile) => m.status === 'approved' && !existingIds.has(m.user_id))

    if (!q) return approved.slice(0, 15)
    return approved
        .filter((m: MemberProfile) =>
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

const filteredLpathOptions = computed(() => {
    const q = lpathLeaderSearch.value.toLowerCase()
    const options = lpathLeaders.value.map(l => {
        const profile = admin.members.find(m => m.user_id === l.user_id)
        return {
            ...l,
            profile_photo_url: profile?.profile_photo_url,
            email: profile?.email
        }
    })

    if (!q) return options.slice(0, 15)
    return options
        .filter(l =>
            `${l.user?.first_name} ${l.user?.last_name}`.toLowerCase().includes(q) ||
            l.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

const filteredNetworkOptions = computed(() => {
    const q = networkLeaderSearch.value.toLowerCase()
    const options = networkLeaders.value.map(n => {
        const profile = admin.members.find(m => m.user_id === n.user_id)
        return {
            ...n,
            profile_photo_url: profile?.profile_photo_url,
            email: profile?.email
        }
    })

    if (!q) return options.slice(0, 15)
    return options
        .filter(n =>
            `${n.user?.first_name} ${n.user?.last_name}`.toLowerCase().includes(q) ||
            n.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

function selectUser(m: MemberProfile) {
    form.value.user_id = m.user_id
    memberSearch.value = `${m.first_name} ${m.last_name}`
    showMemberDropdown.value = false
}

function selectLpathLeader(l: LpathLeaderOption & { profile_photo_url?: string; email?: string }) {
    form.value.lpath_leader_id = l.user_id
    lpathLeaderSearch.value = displayName(l.user)
    showLpathDropdown.value = false
    onLpathLeaderChange()
}

function selectNetworkLeader(n: NetworkLeaderOption & { profile_photo_url?: string; email?: string }) {
    form.value.network_leader_id = n.id
    networkLeaderSearch.value = displayName(n.user)
    showNetworkDropdown.value = false
}

function hideLpathDropdown() {
    setTimeout(() => { showLpathDropdown.value = false }, 200)
}

function hideNetworkDropdown() {
    setTimeout(() => { showNetworkDropdown.value = false }, 200)
}

function hideUserDropdown() {
    setTimeout(() => { showMemberDropdown.value = false }, 200)
}

onMounted(async () => {
    await Promise.all([fetchMembers(), admin.fetchMembers(), fetchLpathLeaders(), fetchNetworkLeaders(), fetchChurches()])
    loading.value = false
})

async function fetchMembers() {
    const { data } = await supabase
        .from('tbl_lpath_members')
        .select('*, user:tbl_users!tbl_lpath_members_user_id_fkey(id, first_name, last_name, email)')
        .order('created_at', { ascending: false })
    members.value = (data as LpathMember[]) ?? []
}

async function fetchLpathLeaders() {
    const { data } = await supabase
        .from('tbl_lpath_leaders')
        .select('id, user_id, network_id, network_name, pastor_id, pastor_name, user:tbl_users!tbl_lpath_leaders_user_id_fkey(first_name, last_name)')
        .eq('is_active', 'Y')
    lpathLeaders.value = (data as LpathLeaderOption[]) ?? []
}

async function fetchNetworkLeaders() {
    const { data } = await supabase
        .from('tbl_network_leaders')
        .select('id, user_id, pastor_id, pastor_name, user:tbl_users!tbl_network_leaders_user_id_fkey(first_name, last_name)')
        .eq('is_active', 'Y')
    networkLeaders.value = (data as NetworkLeaderOption[]) ?? []
}

async function fetchChurches() {
    const { data } = await supabase.from('lib_satellite_churches').select('id, church_name').eq('is_active', true).order('church_name')
    churches.value = data ?? []
}

const filtered = computed(() => {
    let list = members.value
    const q = search.value.toLowerCase()
    if (q) {
        list = list.filter(m => {
            const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
            return name.includes(q) || m.user?.email?.toLowerCase().includes(q)
        })
    }
    if (lpathFilter.value) list = list.filter(m => m.lpath_leader_id === lpathFilter.value)
    if (networkFilter.value) list = list.filter(m => m.network_leader_id === networkFilter.value)
    return list
})

function getMemberName(userId: string) {
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function displayName(u?: { first_name: string | null; last_name: string | null }) {
    if (!u) return '—'
    return [u.first_name, u.last_name].filter(Boolean).join(' ')
}

function openAdd() {
    editingId.value = null
    form.value = { user_id: '', lpath_leader_id: '', network_leader_id: null, church_id: null, date_started: new Date().toISOString().split('T')[0], is_active: 'Y' }
    memberSearch.value = ''
    lpathLeaderSearch.value = ''
    networkLeaderSearch.value = ''
    showMemberDropdown.value = false
    showLpathDropdown.value = false
    showNetworkDropdown.value = false
    showModal.value = true
}

function openEdit(m: LpathMember) {
    editingId.value = m.id
    form.value = {
        user_id: m.user_id,
        lpath_leader_id: m.lpath_leader_id ?? '',
        network_leader_id: m.network_leader_id,
        church_id: m.church_id,
        date_started: m.date_started ?? '',
        is_active: m.is_active ?? 'Y',
    }
    memberSearch.value = displayName(m.user) || getMemberName(m.user_id)
    lpathLeaderSearch.value = m.lpath_leader_name ?? ''
    networkLeaderSearch.value = m.network_leader_name ?? ''
    showMemberDropdown.value = false
    showLpathDropdown.value = false
    showNetworkDropdown.value = false
    showModal.value = true
}

// When lpath leader changes, auto-set network leader
function onLpathLeaderChange() {
    const leader = lpathLeaders.value.find(l => l.user_id === form.value.lpath_leader_id)
    if (leader) {
        form.value.network_leader_id = leader.network_id
        networkLeaderSearch.value = leader.network_name ?? ''
    }
}

const selectedLpathName = computed(() => {
    const l = lpathLeaders.value.find(l => l.user_id === form.value.lpath_leader_id)
    return l ? displayName(l.user) : null
})

const selectedNetworkName = computed(() => {
    const n = networkLeaders.value.find(n => n.id === form.value.network_leader_id)
    return n ? displayName(n.user) : null
})

const selectedPastorName = computed(() => {
    const n = networkLeaders.value.find(n => n.id === form.value.network_leader_id)
    if (n?.pastor_name) return n.pastor_name
    const l = lpathLeaders.value.find(l => l.user_id === form.value.lpath_leader_id)
    return l?.pastor_name ?? null
})

async function handleSave() {
    if (!form.value.user_id) return
    saving.value = true
    message.value = null

    const selectedChurch = churches.value.find(c => c.id === form.value.church_id)
    const selectedLpathLeader = lpathLeaders.value.find(l => l.user_id === form.value.lpath_leader_id)
    const selectedNetworkLeader = networkLeaders.value.find(n => n.id === form.value.network_leader_id)

    const payload = {
        user_id: form.value.user_id,
        lpath_leader_id: form.value.lpath_leader_id || null,
        lpath_leader_name: selectedLpathName.value,
        network_leader_id: form.value.network_leader_id,
        network_leader_name: selectedNetworkName.value,
        pastor_id: selectedNetworkLeader?.pastor_id ?? selectedLpathLeader?.pastor_id ?? null,
        pastor_name: selectedPastorName.value,
        church_id: form.value.church_id,
        church_name: selectedChurch?.church_name ?? null,
        date_started: form.value.date_started || null,
        is_active: form.value.is_active,
    }

    if (editingId.value) {
        const { error } = await supabase.from('tbl_lpath_members').update(payload).eq('id', editingId.value)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'L-Path member updated.' }
    } else {
        const { error } = await supabase.from('tbl_lpath_members').insert(payload)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'L-Path member added.' }
    }

    saving.value = false
    showModal.value = false
    await fetchMembers()
}

async function toggleActive(m: LpathMember) {
    await supabase.from('tbl_lpath_members').update({ is_active: m.is_active === 'Y' ? 'N' : 'Y' }).eq('id', m.id)
    await fetchMembers()
}

function openRemove(m: LpathMember) {
    removeTarget.value = m
    showRemoveModal.value = true
}

async function handleRemove() {
    if (!removeTarget.value) return
    removing.value = true
    message.value = null

    const { error } = await supabase.from('tbl_lpath_members').delete().eq('id', removeTarget.value.id)

    if (error) {
        message.value = { type: 'error', text: `Unable to remove L-Path member: ${error.message}` }
    } else {
        message.value = { type: 'success', text: 'L-Path member assignment removed.' }
        await fetchMembers()
    }

    removing.value = false
    showRemoveModal.value = false
    removeTarget.value = null
}

// function formatDate no longer used in template for this page?
// Wait, checking template usage.

function churchName(id: number | null) {
    if (!id) return '—'
    return churches.value.find(c => c.id === id)?.church_name ?? '—'
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">L-Path Members</h1>
                <p class="text-sm text-gray-500 mt-1">{{ filtered.length }} member{{ filtered.length !== 1 ? 's' : '' }}</p>
            </div>
            <button class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors" @click="openAdd">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add L-Path Member
            </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-4">
            <input v-model="search" type="text" placeholder="Search by name or email..." class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
            <select v-model="lpathFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                <option value="">All L-Path Leaders</option>
                <option v-for="l in lpathLeaders" :key="l.user_id" :value="l.user_id">{{ displayName(l.user) }}</option>
            </select>
            <select v-model="networkFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                <option :value="null">All Network Leaders</option>
                <option v-for="n in networkLeaders" :key="n.id" :value="n.id">{{ displayName(n.user) }}</option>
            </select>
        </div>

        <p v-if="message" class="text-sm rounded-lg px-4 py-2 mb-4" :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">{{ message.text }}</p>

        <div v-if="loading" class="space-y-3"><div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" /></div>
        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No L-Path members found.</div>

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
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.lpath_leader_name ?? '—' }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.network_leader_name ?? '—' }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden xl:table-cell">{{ churchName(m.church_id) }}</td>
                            <td class="px-4 py-3">
                                <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                                    {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <button class="text-navy hover:text-navy-600 text-sm font-medium mr-3" @click="openEdit(m)">Edit</button>
                                <button class="text-sm font-medium mr-3" :class="m.is_active === 'Y' ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'" @click="toggleActive(m)">
                                    {{ m.is_active === 'Y' ? 'Deactivate' : 'Activate' }}
                                </button>
                                <button class="text-red-600 hover:text-red-700 text-sm font-medium" @click="openRemove(m)">Remove</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal -->
        <Teleport to="body">
            <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showModal = false">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">{{ editingId ? 'Edit' : 'Add' }} L-Path Member</h3>
                    <div class="space-y-4">
                        <div class="relative">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                            <input
                                v-model="memberSearch"
                                type="text"
                                placeholder="Search by name or email..."
                                :disabled="!!editingId"
                                @focus="showMemberDropdown = true"
                                @blur="hideUserDropdown"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:bg-gray-50"
                            />

                            <!-- Search Dropdown -->
                            <div
                                v-if="showMemberDropdown"
                                class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                            >
                                <div
                                    v-for="m in availableUsers"
                                    :key="m.user_id"
                                    @mousedown="selectUser(m)"
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
                                <div v-if="!availableUsers.length" class="px-3 py-4 text-center text-xs text-gray-400">
                                    No members found.
                                </div>
                            </div>
                        </div>
                        <div class="relative">
                            <label class="block text-sm font-medium text-gray-700 mb-1">L-Path Leader (Under)</label>
                            <input
                                v-model="lpathLeaderSearch"
                                type="text"
                                placeholder="Search L-Path leader..."
                                @focus="showLpathDropdown = true"
                                @blur="hideLpathDropdown"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />

                            <!-- L-Path Search Dropdown -->
                            <div
                                v-if="showLpathDropdown"
                                class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                            >
                                <div
                                    v-for="l in filteredLpathOptions"
                                    :key="l.user_id"
                                    @mousedown="selectLpathLeader(l)"
                                    class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <div class="w-8 h-8 rounded-full overflow-hidden bg-navy/5 flex items-center justify-center shrink-0">
                                        <img v-if="l.profile_photo_url" :src="l.profile_photo_url" class="w-full h-full object-cover" />
                                        <span v-else class="text-[10px] font-bold text-navy">
                                            {{ l.user?.first_name?.[0] }}{{ l.user?.last_name?.[0] }}
                                        </span>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-xs font-semibold text-gray-900 truncate">{{ displayName(l.user) }}</p>
                                        <p class="text-[10px] text-gray-400 truncate">{{ l.email }}</p>
                                    </div>
                                </div>
                                <div v-if="!filteredLpathOptions.length" class="px-3 py-4 text-center text-xs text-gray-400">
                                    No L-Path leaders found.
                                </div>
                            </div>
                        </div>
                        <div class="relative">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Network Leader</label>
                            <input
                                v-model="networkLeaderSearch"
                                type="text"
                                placeholder="Search network leader..."
                                @focus="showNetworkDropdown = true"
                                @blur="hideNetworkDropdown"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />

                            <!-- Network Search Dropdown -->
                            <div
                                v-if="showNetworkDropdown"
                                class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                            >
                                <div
                                    v-for="n in filteredNetworkOptions"
                                    :key="n.user_id"
                                    @mousedown="selectNetworkLeader(n)"
                                    class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <div class="w-8 h-8 rounded-full overflow-hidden bg-navy/5 flex items-center justify-center shrink-0">
                                        <img v-if="n.profile_photo_url" :src="n.profile_photo_url" class="w-full h-full object-cover" />
                                        <span v-else class="text-[10px] font-bold text-navy">
                                            {{ n.user?.first_name?.[0] }}{{ n.user?.last_name?.[0] }}
                                        </span>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="text-xs font-semibold text-gray-900 truncate">{{ displayName(n.user) }}</p>
                                        <p class="text-[10px] text-gray-400 truncate">{{ n.email }}</p>
                                    </div>
                                </div>
                                <div v-if="!filteredNetworkOptions.length" class="px-3 py-4 text-center text-xs text-gray-400">
                                    No network leaders found.
                                </div>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Pastor</label>
                            <input
                                :value="selectedPastorName ?? ''"
                                type="text"
                                readonly
                                placeholder="Auto-filled from leader"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 focus:outline-none cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                            <select v-model="form.church_id" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                <option :value="null">Select a church...</option>
                                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Date Started</label>
                            <input v-model="form.date_started" type="date" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select v-model="form.is_active" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                <option value="Y">Active</option>
                                <option value="N">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showModal = false">Cancel</button>
                        <button :disabled="!form.user_id || saving" class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50" @click="handleSave">
                            {{ saving ? 'Saving...' : editingId ? 'Update' : 'Add' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <Teleport to="body">
            <div v-if="showRemoveModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showRemoveModal = false">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-gray-900 mb-2">Remove L-Path Member</h3>
                    <p class="text-sm text-gray-600">
                        Remove <strong>{{ displayName(removeTarget?.user) }}</strong> from their L-Path? Their member account and profile will remain.
                    </p>
                    <div class="flex justify-end gap-3 mt-6">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showRemoveModal = false">Cancel</button>
                        <button :disabled="removing" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50" @click="handleRemove">
                            {{ removing ? 'Removing...' : 'Remove' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
