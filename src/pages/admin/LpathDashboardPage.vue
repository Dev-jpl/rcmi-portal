<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import LeadershipGraph from '@/components/common/LeadershipGraph.vue'
import type { Node, Edge } from '@vue-flow/core'

const auth = useAuthStore()
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

const loading = ref(true)
const search = ref('')
const lpathLeadersList = ref<LpathLeaderOption[]>([])
const selectedLeaderUserId = ref('')
const members = ref<LpathMember[]>([])
const churches = ref<Church[]>([])

onMounted(async () => {
    await fetchChurches()
    if (isScopedView.value) {
        selectedLeaderUserId.value = currentUserId.value
    } else {
        const { data } = await supabase
            .from('tbl_lpath_leaders')
            .select('id, user_id, user:tbl_users!tbl_lpath_leaders_user_id_fkey(first_name, last_name)')
            .eq('is_active', 'Y')
        lpathLeadersList.value = (data as LpathLeaderOption[]) ?? []
        if (lpathLeadersList.value.length) selectedLeaderUserId.value = lpathLeadersList.value[0].user_id
    }
    await fetchMembers()
    loading.value = false
})

watch(selectedLeaderUserId, async () => {
    if (selectedLeaderUserId.value) {
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
    </div>
</template>
