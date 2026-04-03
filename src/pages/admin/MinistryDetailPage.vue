<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'

const props = defineProps<{ id: string }>()
const router = useRouter()
const admin = useAdminStore()

interface Ministry {
    id: number
    ministry_type: string
    description: string | null
    is_active: boolean
}

interface MemberProfile {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo_url: string | null
    status?: string | null
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
    ministry_type_id: number
    ministry_type: string | null
    role_title: string | null
    description: string | null
    is_active: boolean
}

const ministry = ref<Ministry | null>(null)
const members = ref<Involvement[]>([])
const roles = ref<MinistryRole[]>([])
const activeTab = ref<'members' | 'roles'>('members')
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

// Roles management
const showRoleModal = ref(false)
const editingRoleId = ref<number | null>(null)
const savingRole = ref(false)
const showDeleteRoleModal = ref(false)
const deleteRoleTarget = ref<MinistryRole | null>(null)
const deletingRole = ref(false)
const roleForm = ref({
    role_title: '',
    description: '',
    is_active: true,
})

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
    const selected = roles.value.find(r => r.id === form.value.ministry_role_id)
    form.value.ministry_role_title = selected?.role_title ?? ''
}

onMounted(async () => {
    await Promise.all([fetchMinistry(), fetchMembers(), admin.fetchMembers(), fetchRoles()])
    loading.value = false
})

async function fetchMinistry() {
    const { data } = await supabase
        .from('lib_ministries')
        .select('*')
        .eq('id', Number(props.id))
        .single()
    ministry.value = data as Ministry | null
}

async function fetchMembers() {
    const { data } = await supabase
        .from('tbl_ministry_involvements')
        .select('*, user:tbl_users!tbl_ministry_involvements_user_id_fkey(id, first_name, last_name, email)')
        .eq('ministry_id', Number(props.id))
        .order('date_started', { ascending: false })
    members.value = (data ?? []) as Involvement[]
}

async function fetchRoles() {
    const { data } = await supabase
        .from('lib_ministry_roles')
        .select('*')
        .eq('ministry_type_id', Number(props.id))
        .order('role_title')
    roles.value = (data ?? []) as MinistryRole[]
}

function openAddRole() {
    editingRoleId.value = null
    roleForm.value = { role_title: '', description: '', is_active: true }
    showRoleModal.value = true
}

function openEditRole(r: MinistryRole) {
    editingRoleId.value = r.id
    roleForm.value = {
        role_title: r.role_title ?? '',
        description: r.description ?? '',
        is_active: r.is_active,
    }
    showRoleModal.value = true
}

function openDeleteRole(r: MinistryRole) {
    deleteRoleTarget.value = r
    showDeleteRoleModal.value = true
}

async function handleSaveRole() {
    if (!roleForm.value.role_title.trim()) return
    savingRole.value = true
    message.value = null

    const payload = {
        ministry_type_id: Number(props.id),
        ministry_type: ministry.value?.ministry_type ?? null,
        role_title: roleForm.value.role_title.trim(),
        description: roleForm.value.description.trim() || null,
        is_active: roleForm.value.is_active,
    }

    if (editingRoleId.value) {
        const { error } = await supabase.from('lib_ministry_roles').update(payload).eq('id', editingRoleId.value)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Role updated.' }
    } else {
        const { error } = await supabase.from('lib_ministry_roles').insert(payload)
        message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Role created.' }
    }

    savingRole.value = false
    showRoleModal.value = false
    await fetchRoles()
}

async function handleDeleteRole() {
    if (!deleteRoleTarget.value) return
    deletingRole.value = true
    const { error } = await supabase.from('lib_ministry_roles').delete().eq('id', deleteRoleTarget.value.id)
    message.value = error ? { type: 'error', text: error.message } : { type: 'success', text: 'Role deleted.' }
    deletingRole.value = false
    showDeleteRoleModal.value = false
    deleteRoleTarget.value = null
    await fetchRoles()
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

const activeRoles = computed(() => roles.value.filter(r => r.is_active))

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
    if (!form.value.user_id) return
    saving.value = true
    message.value = null

    const payload = {
        user_id: form.value.user_id,
        ministry_id: Number(props.id),
        ministry_type: ministry.value?.ministry_type ?? null,
        ministry_role_id: form.value.ministry_role_id,
        ministry_role_title: form.value.ministry_role_title.trim() || null,
        member_type: form.value.member_type,
        skills: skillsList.value.length ? skillsList.value : [],
        date_started: form.value.date_started || null,
        is_active: form.value.is_active,
    }

    if (editingId.value) {
        const { error } = await supabase
            .from('tbl_ministry_involvements')
            .update(payload)
            .eq('id', editingId.value)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Member updated.' }
        }
    } else {
        const { error } = await supabase.from('tbl_ministry_involvements').insert(payload)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Member enrolled.' }
        }
    }

    saving.value = false
    showModal.value = false
    await fetchMembers()
}

async function handleDelete() {
    if (!deleteTarget.value) return
    deleting.value = true

    const { error } = await supabase
        .from('tbl_ministry_involvements')
        .delete()
        .eq('id', deleteTarget.value.id)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: 'Member removed.' }
    }

    deleting.value = false
    showDeleteModal.value = false
    deleteTarget.value = null
    await fetchMembers()
}

async function toggleActive(m: Involvement) {
    const newStatus = m.is_active === 'Y' ? 'N' : 'Y'
    await supabase.from('tbl_ministry_involvements').update({ is_active: newStatus }).eq('id', m.id)
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

function getMemberName(userId: string) {
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}
</script>

<template>
    <div>
        <!-- Back + Header -->
        <div class="mb-6">
            <button @click="router.push({ name: 'admin-ministries' })" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy mb-3 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Back to Ministries
            </button>

            <div v-if="loading" class="space-y-2">
                <div class="h-8 bg-gray-200 rounded w-48 animate-pulse" />
                <div class="h-4 bg-gray-200 rounded w-72 animate-pulse" />
            </div>
            <template v-else-if="ministry">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-3">
                            <h1 class="text-2xl font-heading font-bold text-navy">{{ ministry.ministry_type }}</h1>
                            <span
                                class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="ministry.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                            >
                                {{ ministry.is_active ? 'Active' : 'Inactive' }}
                            </span>
                        </div>
                        <p v-if="ministry.description" class="text-sm text-gray-500 mt-1">{{ ministry.description }}</p>
                    </div>
                    <button
                        class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors shrink-0"
                        @click="openAdd"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Enroll Member
                    </button>
                </div>
            </template>
            <div v-else class="text-center py-12 text-gray-400">Ministry not found.</div>
        </div>

        <!-- Stats -->
        <div v-if="ministry" class="grid grid-cols-3 gap-3 mb-6">
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

        <!-- Tabs -->
        <div v-if="ministry" class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button
                @click="activeTab = 'members'"
                class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                :class="activeTab === 'members' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            >
                Members
            </button>
            <button
                @click="activeTab = 'roles'"
                class="flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                :class="activeTab === 'roles' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
            >
                Roles ({{ roles.length }})
            </button>
        </div>

        <!-- ═══ MEMBERS TAB ═══ -->
        <template v-if="activeTab === 'members'">

        <!-- Search + Filter -->
        <div v-if="ministry" class="flex flex-col sm:flex-row gap-3 mb-4">
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

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="ministry && !filtered.length" class="text-center py-12 text-gray-400">No members enrolled yet.</div>

        <!-- Table -->
        <div v-else-if="ministry && filtered.length" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
                                    <span v-for="(s, i) in m.skills" :key="i" class="inline-flex px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{{ s }}</span>
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

        </template><!-- end members tab -->

        <!-- ═══ ROLES TAB ═══ -->
        <template v-if="activeTab === 'roles'">
            <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-gray-500">{{ roles.length }} role{{ roles.length !== 1 ? 's' : '' }} defined</p>
                <button
                    class="inline-flex items-center gap-2 px-3 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors"
                    @click="openAddRole"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Role
                </button>
            </div>

            <div v-if="!roles.length" class="text-center py-12 text-gray-400">No roles defined yet. Add roles to help organize ministry members.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Role Title</th>
                            <th class="px-4 py-3 hidden md:table-cell">Description</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="r in roles" :key="r.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3 font-medium text-gray-900">{{ r.role_title }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ r.description ?? '—' }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                    :class="r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                                >
                                    {{ r.is_active ? 'Active' : 'Inactive' }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <button class="text-navy hover:text-navy-600 text-sm font-medium mr-3" @click="openEditRole(r)">Edit</button>
                                <button class="text-red-500 hover:text-red-600 text-sm font-medium" @click="openDeleteRole(r)">Delete</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template><!-- end roles tab -->

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
                                    :class="form.member_type === 'head'
                                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                                >
                                    Ministry Head
                                </button>
                                <button
                                    type="button"
                                    @click="form.member_type = 'servant'"
                                    class="px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                                    :class="form.member_type === 'servant'
                                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'"
                                >
                                    Ministry Servant
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                v-model="form.ministry_role_id"
                                @change="onRoleSelect"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option :value="null">No specific role</option>
                                <option v-for="r in activeRoles" :key="r.id" :value="r.id">{{ r.role_title }}</option>
                            </select>
                            <p v-if="!activeRoles.length" class="text-xs text-gray-400 mt-1">No roles defined yet. Add roles in the Roles tab.</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Skills</label>
                            <div class="flex flex-wrap gap-1.5 mb-2" v-if="skillsList.length">
                                <span
                                    v-for="(skill, i) in skillsList"
                                    :key="i"
                                    class="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md"
                                >
                                    {{ skill }}
                                    <button type="button" @click="removeSkill(i)" class="text-blue-400 hover:text-blue-600">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </span>
                            </div>
                            <div class="flex gap-2">
                                <input
                                    v-model="skillInput"
                                    type="text"
                                    placeholder="e.g. Singing, Guitar, Sound mixing..."
                                    class="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    @keydown.enter.prevent="addSkill"
                                />
                                <button type="button" @click="addSkill" class="px-3 py-2.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors shrink-0">Add</button>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">Press Enter or click Add for each skill</p>
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
                            {{ saving ? 'Saving...' : editingId ? 'Update' : 'Enroll' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Confirmation Modal -->
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

        <!-- Add/Edit Role Modal -->
        <Teleport to="body">
            <div
                v-if="showRoleModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showRoleModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">
                        {{ editingRoleId ? 'Edit' : 'Add' }} Role
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Role Title</label>
                            <input
                                v-model="roleForm.role_title"
                                type="text"
                                placeholder="e.g. Worship Leader, Guitarist, Sound Engineer..."
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                v-model="roleForm.description"
                                rows="2"
                                placeholder="Short description of this role..."
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                v-model="roleForm.is_active"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option :value="true">Active</option>
                                <option :value="false">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showRoleModal = false">Cancel</button>
                        <button
                            :disabled="!roleForm.role_title.trim() || savingRole"
                            class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50"
                            @click="handleSaveRole"
                        >
                            {{ savingRole ? 'Saving...' : editingRoleId ? 'Update' : 'Create' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Role Modal -->
        <Teleport to="body">
            <div
                v-if="showDeleteRoleModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showDeleteRoleModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                    <h3 class="text-lg font-heading font-bold text-gray-900 mb-2">Delete Role</h3>
                    <p class="text-sm text-gray-500 mb-6">
                        Are you sure you want to delete the role <strong>{{ deleteRoleTarget?.role_title }}</strong>?
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showDeleteRoleModal = false">Cancel</button>
                        <button :disabled="deletingRole" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50" @click="handleDeleteRole">
                            {{ deletingRole ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
