<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useAdminStore } from '@/stores/admin.store'
import { supabase } from '@/lib/supabase'

const auth = useAuthStore()
const admin = useAdminStore()
const route = useRoute()
const router = useRouter()

interface Ministry {
    id: number
    ministry_type: string
    description: string | null
}

interface Involvement {
    id: number
    user_id: string
    ministry_id: number
    ministry_type: string | null
    ministry_role_id: number | null
    ministry_role_title: string | null
    member_type: string | null
    skills: string[] | null
    date_started: string | null
    is_active: string | null
    user?: { id: string; first_name: string | null; last_name: string | null; email: string }
}

interface MinistryRole {
    id: number
    role_title: string | null
}

interface MemberProfile {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo_url: string | null
    status?: string | null
}

const myMinistries = ref<Ministry[]>([])
const selectedMinistryId = ref<number | null>(null)
const members = ref<Involvement[]>([])
const ministryRoles = ref<MinistryRole[]>([])
const loading = ref(true)
const search = ref('')
const filterType = ref<'all' | 'head' | 'servant'>('all')
const showModal = ref(false)
const showDeleteModal = ref(false)
const deleteTarget = ref<Involvement | null>(null)
const editingId = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const saving = ref(false)
const deleting = ref(false)
const skillInput = ref('')
const skillsList = ref<string[]>([])

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

const form = ref({
    user_id: '',
    ministry_role_id: null as number | null,
    ministry_role_title: '',
    member_type: 'servant' as 'head' | 'servant',
    date_started: new Date().toISOString().split('T')[0],
    is_active: 'Y',
})

function addSkill() {
    const val = skillInput.value.trim()
    if (val && !skillsList.value.includes(val)) {
        skillsList.value.push(val)
    }
    skillInput.value = ''
}

function removeSkill(index: number) {
    skillsList.value.splice(index, 1)
}

function onRoleSelect() {
    const selected = ministryRoles.value.find(r => r.id === form.value.ministry_role_id)
    form.value.ministry_role_title = selected?.role_title ?? ''
}

const selectedMinistry = computed(() => myMinistries.value.find(m => m.id === selectedMinistryId.value) ?? null)

onMounted(async () => {
    await Promise.all([fetchMyMinistries(), admin.fetchMembers()])
    
    if (route.query.mid) {
        selectedMinistryId.value = Number(route.query.mid)
    } else if (myMinistries.value.length > 0 && !selectedMinistryId.value) {
        selectedMinistryId.value = myMinistries.value[0]!.id
        router.replace({ query: { mid: selectedMinistryId.value } })
    }
    
    if (selectedMinistryId.value) {
        await loadMinistryData()
    }
    loading.value = false
})

watch(() => route.query.mid, async (newMid) => {
    if (newMid && Number(newMid) !== selectedMinistryId.value) {
        selectedMinistryId.value = Number(newMid)
        members.value = []
        search.value = ''
        filterType.value = 'all'
        await loadMinistryData()
    }
})

async function fetchMyMinistries() {
    if (!auth.ministryHeadIds.length) return

    const { data } = await supabase
        .from('lib_ministries')
        .select('id, ministry_type, description')
        .in('id', auth.ministryHeadIds)
        .order('ministry_type')

    myMinistries.value = (data ?? []) as Ministry[]
}

async function loadMinistryData() {
    if (!selectedMinistryId.value) return
    const mid = selectedMinistryId.value

    const [membersRes, rolesRes] = await Promise.all([
        supabase
            .from('tbl_ministry_involvements')
            .select('*, user:tbl_users!tbl_ministry_involvements_user_id_fkey(id, first_name, last_name, email)')
            .eq('ministry_id', mid)
            .order('date_started', { ascending: false }),
        supabase
            .from('lib_ministry_roles')
            .select('id, role_title')
            .eq('ministry_type_id', mid)
            .eq('is_active', true),
    ])

    members.value = (membersRes.data ?? []) as Involvement[]
    ministryRoles.value = (rolesRes.data ?? []) as MinistryRole[]
}


const filtered = computed(() => {
    let list = members.value
    if (filterType.value !== 'all') {
        list = list.filter(m => (m.member_type ?? 'servant') === filterType.value)
    }
    const q = search.value.toLowerCase()
    if (!q) return list
    return list.filter(m => {
        const name = `${m.user?.first_name ?? ''} ${m.user?.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || m.user?.email?.toLowerCase().includes(q) || m.ministry_role_title?.toLowerCase().includes(q)
    })
})

const headCount = computed(() => members.value.filter(m => m.member_type === 'head' && m.is_active === 'Y').length)
const servantCount = computed(() => members.value.filter(m => (m.member_type ?? 'servant') === 'servant' && m.is_active === 'Y').length)
const totalActive = computed(() => members.value.filter(m => m.is_active === 'Y').length)

const activeRoles = computed(() => ministryRoles.value.filter(r => r.role_title))

function openAdd() {
    editingId.value = null
    form.value = {
        user_id: '',
        ministry_role_id: null,
        ministry_role_title: '',
        member_type: 'servant',
        date_started: new Date().toISOString().split('T')[0],
        is_active: 'Y',
    }
    memberSearch.value = ''
    showMemberDropdown.value = false
    skillsList.value = []
    skillInput.value = ''
    showModal.value = true
}

function openEdit(m: Involvement) {
    editingId.value = m.id
    form.value = {
        user_id: m.user_id,
        ministry_role_id: m.ministry_role_id ?? null,
        ministry_role_title: m.ministry_role_title ?? '',
        member_type: (m.member_type as 'head' | 'servant') ?? 'servant',
        date_started: m.date_started ?? '',
        is_active: m.is_active ?? 'Y',
    }
    memberSearch.value = userName(m.user) || getMemberName(m.user_id)
    showMemberDropdown.value = false
    skillsList.value = Array.isArray(m.skills) ? [...m.skills] : []
    skillInput.value = ''
    showModal.value = true
}

function openDelete(m: Involvement) {
    deleteTarget.value = m
    showDeleteModal.value = true
}

async function handleSave() {
    if (!form.value.user_id || !selectedMinistryId.value) return
    saving.value = true
    message.value = null

    const payload = {
        user_id: form.value.user_id,
        ministry_id: selectedMinistryId.value,
        ministry_type: selectedMinistry.value?.ministry_type ?? null,
        ministry_role_id: form.value.ministry_role_id,
        ministry_role_title: form.value.ministry_role_title.trim() || null,
        member_type: form.value.member_type,
        date_started: form.value.date_started || null,
        is_active: form.value.is_active,
        skills: skillsList.value.length ? skillsList.value : null,
    }

    if (editingId.value) {
        const { error } = await supabase.from('tbl_ministry_involvements').update(payload).eq('id', editingId.value)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Member updated.' }
    } else {
        const { error } = await supabase.from('tbl_ministry_involvements').insert(payload)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Member enrolled.' }
    }

    saving.value = false
    showModal.value = false
    await loadMinistryData()
}

async function handleDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    const { error } = await supabase.from('tbl_ministry_involvements').delete().eq('id', deleteTarget.value.id)
    message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Member removed.' }
    deleting.value = false
    showDeleteModal.value = false
    deleteTarget.value = null
    await loadMinistryData()
}

async function toggleActive(m: Involvement) {
    const newStatus = m.is_active === 'Y' ? 'N' : 'Y'
    await supabase.from('tbl_ministry_involvements').update({ is_active: newStatus }).eq('id', m.id)
    await loadMinistryData()
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function userName(u?: { first_name: string | null; last_name: string | null }) {
    if (!u) return '—'
    return [u.first_name, u.last_name].filter(Boolean).join(' ')
}

function getMemberName(userId: string) {
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">My Ministry</h1>
                <p class="text-sm text-gray-500 mt-1">Manage your ministry members and assignments</p>
            </div>
            <button
                v-if="selectedMinistryId"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Enroll Member
            </button>
        </div>


        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div class="h-20 bg-gray-200 rounded-lg animate-pulse" />
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <template v-else-if="!myMinistries.length">
            <div class="text-center py-12 text-gray-400">You are not assigned as a ministry head.</div>
        </template>

        <template v-else>
            <!-- Ministry Info -->
            <div v-if="selectedMinistry" class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-navy to-navy-600 flex items-center justify-center shrink-0">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="font-heading font-semibold text-navy text-lg">{{ selectedMinistry.ministry_type }}</h2>
                        <p v-if="selectedMinistry.description" class="text-sm text-gray-500">{{ selectedMinistry.description }}</p>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-3 mb-6">
                <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <p class="text-2xl font-heading font-bold text-navy">{{ totalActive }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">Total Active</p>
                </div>
                <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <p class="text-2xl font-heading font-bold text-amber-600">{{ headCount }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">Ministry Heads</p>
                </div>
                <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <p class="text-2xl font-heading font-bold text-blue-600">{{ servantCount }}</p>
                    <p class="text-xs text-gray-500 mt-0.5">Ministry Servants</p>
                </div>
            </div>

            <!-- Search + Filter -->
            <div class="flex flex-col sm:flex-row gap-3 mb-4">
                <input
                    v-model="search"
                    type="text"
                    placeholder="Search by name, email, or role..."
                    class="flex-1 sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                />
                <div class="flex gap-1 bg-gray-50 rounded-lg p-0.5">
                    <button
                        v-for="tab in (['all', 'head', 'servant'] as const)"
                        :key="tab"
                        @click="filterType = tab"
                        class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize"
                        :class="filterType === tab ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                    >
                        {{ tab === 'head' ? 'Heads' : tab === 'servant' ? 'Servants' : 'All' }}
                    </button>
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

            <!-- Empty -->
            <div v-if="!filtered.length" class="text-center py-12 text-gray-400">No members enrolled yet.</div>

            <!-- Table -->
            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Role</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Skills</th>
                                <th class="px-4 py-3">Type</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Started</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="m in filtered" :key="m.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                            :class="m.member_type === 'head' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
                                        >
                                            {{ (m.user?.first_name?.[0] ?? '') + (m.user?.last_name?.[0] ?? '') }}
                                        </div>
                                        <div class="min-w-0">
                                            <span class="font-medium text-gray-900">{{ userName(m.user) }}</span>
                                            <p class="text-xs text-gray-400 md:hidden">{{ m.user?.email ?? '' }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.ministry_role_title ?? '—' }}</td>
                                <td class="px-4 py-3 hidden lg:table-cell">
                                    <div v-if="Array.isArray(m.skills) && m.skills.length" class="flex flex-wrap gap-1">
                                        <span v-for="(s, si) in m.skills" :key="si" class="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full">{{ s }}</span>
                                    </div>
                                    <span v-else class="text-gray-400">—</span>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                                        :class="m.member_type === 'head' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
                                    >
                                        {{ m.member_type === 'head' ? 'Head' : 'Servant' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(m.date_started) }}</td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                        :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                                    >
                                        {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    <button class="text-navy hover:text-navy-600 text-sm font-medium mr-2" @click="openEdit(m)">Edit</button>
                                    <button
                                        class="text-sm font-medium mr-2"
                                        :class="m.is_active === 'Y' ? 'text-orange-500 hover:text-orange-600' : 'text-green-600 hover:text-green-700'"
                                        @click="toggleActive(m)"
                                    >
                                        {{ m.is_active === 'Y' ? 'Deactivate' : 'Activate' }}
                                    </button>
                                    <button class="text-red-500 hover:text-red-600 text-sm font-medium" @click="openDelete(m)">Remove</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Enroll / Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">
                        {{ editingId ? 'Edit' : 'Enroll' }} Member
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
                            <label class="block text-sm font-medium text-gray-700 mb-1">Member Type</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    @click="form.member_type = 'head'"
                                    class="px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                                    :class="form.member_type === 'head' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                                >
                                    Ministry Head
                                </button>
                                <button
                                    type="button"
                                    @click="form.member_type = 'servant'"
                                    class="px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                                    :class="form.member_type === 'servant' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                                >
                                    Ministry Servant
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                v-model="form.ministry_role_id"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                @change="onRoleSelect"
                            >
                                <option :value="null">— Select role —</option>
                                <option v-for="r in activeRoles" :key="r.id" :value="r.id">{{ r.role_title }}</option>
                            </select>
                            <p v-if="!activeRoles.length" class="text-xs text-amber-500 mt-1">No roles defined yet. Ask admin to add roles for this ministry.</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Skills</label>
                            <div class="flex gap-2">
                                <input
                                    v-model="skillInput"
                                    type="text"
                                    placeholder="Type a skill and press Enter..."
                                    class="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    @keydown.enter.prevent="addSkill"
                                />
                                <button type="button" class="px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-200" @click="addSkill">Add</button>
                            </div>
                            <div v-if="skillsList.length" class="flex flex-wrap gap-1.5 mt-2">
                                <span
                                    v-for="(skill, idx) in skillsList"
                                    :key="idx"
                                    class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                                >
                                    {{ skill }}
                                    <button type="button" class="hover:text-red-500" @click="removeSkill(idx)">&times;</button>
                                </span>
                            </div>
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
                        <button
                            :disabled="!form.user_id || saving"
                            class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50"
                            @click="handleSave"
                        >
                            {{ saving ? 'Saving...' : editingId ? 'Update' : 'Enroll' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Modal -->
        <Teleport to="body">
            <div
                v-if="showDeleteModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showDeleteModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                    <h3 class="text-lg font-heading font-bold text-gray-900 mb-2">Remove Member</h3>
                    <p class="text-sm text-gray-500 mb-6">
                        Are you sure you want to remove <strong>{{ userName(deleteTarget?.user) }}</strong> from this ministry?
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showDeleteModal = false">Cancel</button>
                        <button :disabled="deleting" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50" @click="handleDelete">
                            {{ deleting ? 'Removing...' : 'Remove' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
