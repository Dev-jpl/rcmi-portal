<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'

const admin = useAdminStore()

interface PastoralMember {
    id: number
    user_id: string
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

interface Church {
    id: number
    church_name: string
}

const members = ref<PastoralMember[]>([])
const churches = ref<Church[]>([])
const loading = ref(true)
const search = ref('')
const churchFilter = ref<number | null>(null)
const showModal = ref(false)
const editingId = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const saving = ref(false)

const form = ref({
    user_id: '',
    church_id: null as number | null,
    date_started: new Date().toISOString().split('T')[0],
    is_active: 'Y',
})

// Member search for enrollment
const memberSearch = ref('')
const showMemberDropdown = ref(false)
const availableUsers = computed(() => {
    const q = memberSearch.value.toLowerCase()
    const existingIds = new Set(members.value.filter(m => m.is_active === 'Y' && m.id !== editingId.value).map(m => m.user_id))
    const approved = (admin.members as any[]).filter((m: MemberProfile) => m.status === 'approved' && !existingIds.has(m.user_id))

    if (!q) return approved.slice(0, 15)
    return approved
        .filter((m: MemberProfile) =>
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

function selectUser(m: MemberProfile) {
    form.value.user_id = m.user_id
    memberSearch.value = `${m.first_name} ${m.last_name}`
    showMemberDropdown.value = false
}

function hideUserDropdown() {
    setTimeout(() => { showMemberDropdown.value = false }, 200)
}

onMounted(async () => {
    await Promise.all([fetchMembers(), admin.fetchMembers(), fetchChurches()])
    loading.value = false
})

async function fetchMembers() {
    const { data } = await supabase
        .from('tbl_pastoral_members')
        .select('*, user:tbl_users!tbl_pastoral_members_user_id_fkey(id, first_name, last_name, email)')
        .order('created_at', { ascending: false })
    members.value = (data as PastoralMember[]) ?? []
}

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .eq('is_active', true)
        .order('church_name')
    churches.value = data ?? []
}

const filtered = computed(() => {
    let list = members.value
    const q = search.value.toLowerCase()
    if (q) {
        list = list.filter((m) => {
            const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
            return name.includes(q) || m.user?.email?.toLowerCase().includes(q)
        })
    }
    if (churchFilter.value) {
        list = list.filter(m => m.church_id === churchFilter.value)
    }
    return list
})

function getMemberName(userId: string) {
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function openAdd() {
    editingId.value = null
    form.value = { user_id: '', church_id: null, date_started: new Date().toISOString().split('T')[0], is_active: 'Y' }
    memberSearch.value = ''
    showMemberDropdown.value = false
    showModal.value = true
}

function openEdit(m: PastoralMember) {
    editingId.value = m.id
    form.value = {
        user_id: m.user_id,
        church_id: m.church_id,
        date_started: m.date_started ?? '',
        is_active: m.is_active ?? 'Y',
    }
    memberSearch.value = userName(m.user) || getMemberName(m.user_id)
    showMemberDropdown.value = false
    showModal.value = true
}

async function handleSave() {
    if (!form.value.user_id) return
    saving.value = true
    message.value = null

    const payload = {
        user_id: form.value.user_id,
        church_id: form.value.church_id,
        date_started: form.value.date_started || null,
        is_active: form.value.is_active,
    }

    if (editingId.value) {
        const { error } = await supabase.from('tbl_pastoral_members').update(payload).eq('id', editingId.value)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Pastor updated.' }
    } else {
        const { error } = await supabase.from('tbl_pastoral_members').insert(payload)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Pastor added.' }
    }

    saving.value = false
    showModal.value = false
    await fetchMembers()
}

async function toggleActive(m: PastoralMember) {
    const newStatus = m.is_active === 'Y' ? 'N' : 'Y'
    await supabase.from('tbl_pastoral_members').update({ is_active: newStatus }).eq('id', m.id)
    await fetchMembers()
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function userName(u?: { first_name: string | null; last_name: string | null }) {
    if (!u) return '—'
    return [u.first_name, u.last_name].filter(Boolean).join(' ')
}

function churchName(churchId: number | null) {
    if (!churchId) return '—'
    return churches.value.find(c => c.id === churchId)?.church_name ?? '—'
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Pastors</h1>
                <p class="text-sm text-gray-500 mt-1">{{ filtered.length }} member{{ filtered.length !== 1 ? 's' : '' }}</p>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Pastor
            </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search by name or email..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
            <select
                v-model="churchFilter"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
                <option :value="null">All Churches</option>
                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
            </select>
        </div>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No pastors found.</div>

        <!-- Table -->
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
                        <tr v-for="m in filtered" :key="m.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700 shrink-0">
                                        {{ (m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '') }}
                                    </div>
                                    <span class="font-medium text-gray-900">{{ userName(m.user) }}</span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.user?.email ?? '—' }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ churchName(m.church_id) }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(m.date_started) }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                                >
                                    {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <button class="text-navy hover:text-navy-600 text-sm font-medium mr-3" @click="openEdit(m)">Edit</button>
                                <button
                                    class="text-sm font-medium"
                                    :class="m.is_active === 'Y' ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'"
                                    @click="toggleActive(m)"
                                >
                                    {{ m.is_active === 'Y' ? 'Deactivate' : 'Activate' }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add/Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">
                        {{ editingId ? 'Edit' : 'Add' }} Pastor
                    </h3>
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
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                            <select
                                v-model="form.church_id"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option :value="null">Select a church...</option>
                                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Date Started</label>
                            <input
                                v-model="form.date_started"
                                type="date"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                v-model="form.is_active"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option value="Y">Active</option>
                                <option value="N">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="!form.user_id || saving"
                            class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50"
                            @click="handleSave"
                        >
                            {{ saving ? 'Saving...' : editingId ? 'Update' : 'Add' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
