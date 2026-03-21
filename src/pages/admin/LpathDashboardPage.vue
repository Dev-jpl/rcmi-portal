<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

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

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
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
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-sm text-gray-500">Active Members</p>
                <p class="text-2xl font-bold text-navy mt-1">{{ members.filter(m => m.is_active === 'Y').length }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
                <p class="text-sm text-gray-500">Total Members</p>
                <p class="text-2xl font-bold text-navy mt-1">{{ members.length }}</p>
            </div>
        </div>

        <!-- Search -->
        <div class="mb-4">
            <input v-model="search" type="text" placeholder="Search by name or email..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
        </div>

        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No L-Path members found.</div>

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
    </div>
</template>
