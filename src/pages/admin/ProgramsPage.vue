<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

interface Program {
    id: number
    type: string
    description: string | null
    date_started: string | null
    duration_days: number | null
    is_active: boolean
}

interface Enrollment {
    id: number
    user_id: string
    program_id: number | null
    program_type: string | null
    date_started: string | null
    date_ended: string | null
    is_active: string | null
    created_at: string | null
    approval_status: string | null
    remarks: string | null
}

const admin = useAdminStore()

const activeTab = ref<'library' | 'enrollments'>('library')
const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Programs Library
const programs = ref<Program[]>([])
const showProgramModal = ref(false)
const editingProgram = ref<Program | null>(null)
const programForm = ref({ type: '', description: '', date_started: '', duration_days: null as number | null, is_active: true })
const programSaving = ref(false)

// Delete confirmation
const showDeleteModal = ref(false)
const deleteTarget = ref<{ type: 'program' | 'enrollment'; id: number; label: string } | null>(null)
const deleting = ref(false)

// Enrollments
const enrollments = ref<Enrollment[]>([])
const showEnrollModal = ref(false)
const editingEnrollment = ref<Enrollment | null>(null)
const enrollForm = ref({ user_id: '', program_id: null as number | null, date_started: '', date_ended: '', is_active: 'Y', approval_status: 'approved', remarks: '' })
const enrollSaving = ref(false)

// Member search for enrollment
const memberSearch = ref('')
const showMemberDropdown = ref(false)
const availableMembers = computed(() => {
    const q = memberSearch.value.toLowerCase()
    const approved = admin.members.filter(m => m.status === 'approved')
    if (!q) return approved.slice(0, 15)
    return approved
        .filter(m =>
            `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q)
        )
        .slice(0, 15)
})

function selectMember(m: any) {
    enrollForm.value.user_id = m.user_id
    memberSearch.value = `${m.first_name} ${m.last_name}`
    showMemberDropdown.value = false
}

function hideMemberDropdown() {
    setTimeout(() => { showMemberDropdown.value = false }, 200)
}

onMounted(async () => {
    await Promise.all([fetchPrograms(), fetchEnrollments(), admin.fetchMembers()])
    loading.value = false
})

// ── Programs Library ──

async function fetchPrograms() {
    const { data } = await supabase
        .from('lib_programs')
        .select('*')
        .order('type')
    programs.value = (data ?? []) as Program[]
}

const filteredPrograms = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return programs.value
    return programs.value.filter(
        (p) =>
            p.type.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q),
    )
})

function openAddProgram() {
    editingProgram.value = null
    programForm.value = { type: '', description: '', date_started: '', duration_days: null, is_active: true }
    showProgramModal.value = true
}

function openEditProgram(p: Program) {
    editingProgram.value = p
    programForm.value = {
        type: p.type,
        description: p.description ?? '',
        date_started: p.date_started ?? '',
        duration_days: p.duration_days,
        is_active: p.is_active,
    }
    showProgramModal.value = true
}

async function handleSaveProgram() {
    if (!programForm.value.type.trim()) return
    programSaving.value = true
    message.value = null

    const payload = {
        type: programForm.value.type.trim(),
        description: programForm.value.description.trim() || null,
        date_started: programForm.value.date_started || null,
        duration_days: programForm.value.duration_days ?? null,
        is_active: programForm.value.is_active,
    }

    if (editingProgram.value) {
        const { error } = await supabase
            .from('lib_programs')
            .update(payload)
            .eq('id', editingProgram.value.id)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Program updated.' }
        }
    } else {
        const { error } = await supabase
            .from('lib_programs')
            .insert(payload)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Program created.' }
        }
    }

    programSaving.value = false
    if (message.value?.type === 'success') {
        showProgramModal.value = false
        await fetchPrograms()
    }
}

async function toggleProgramActive(p: Program) {
    const { error } = await supabase
        .from('lib_programs')
        .update({ is_active: !p.is_active })
        .eq('id', p.id)
    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        await fetchPrograms()
    }
}

function openDeleteProgram(p: Program) {
    deleteTarget.value = { type: 'program', id: p.id, label: p.type }
    showDeleteModal.value = true
}

function openDeleteEnrollment(e: Enrollment) {
    deleteTarget.value = { type: 'enrollment', id: e.id, label: `${getMemberName(e.user_id)} from ${getProgramName(e.program_id)}` }
    showDeleteModal.value = true
}

async function handleDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    message.value = null

    const { type, id } = deleteTarget.value

    if (type === 'program') {
        // Delete enrollments for this program first
        await supabase.from('tbl_program_involvements').delete().eq('program_id', id)
        const { error } = await supabase.from('lib_programs').delete().eq('id', id)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Program deleted.' }
            await Promise.all([fetchPrograms(), fetchEnrollments()])
        }
    } else {
        const { error } = await supabase.from('tbl_program_involvements').delete().eq('id', id)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Enrollment removed.' }
            await fetchEnrollments()
        }
    }

    deleting.value = false
    showDeleteModal.value = false
    deleteTarget.value = null
}

function getEnrolledCount(programId: number) {
    return enrollments.value.filter(e => e.program_id === programId && e.is_active === 'Y').length
}

// ── Enrollments ──

async function fetchEnrollments() {
    const { data } = await supabase
        .from('tbl_program_involvements')
        .select('*')
        .order('created_at', { ascending: false })
    enrollments.value = (data ?? []) as Enrollment[]
}

const filteredEnrollments = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return enrollments.value
    return enrollments.value.filter(
        (e) =>
            getMemberName(e.user_id).toLowerCase().includes(q) ||
            getProgramName(e.program_id).toLowerCase().includes(q) ||
            e.program_type?.toLowerCase().includes(q),
    )
})

function openAddCompleted() {
    editingEnrollment.value = null
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    enrollForm.value = { user_id: '', program_id: null, date_started: '', date_ended: localToday, is_active: 'N', approval_status: 'approved', remarks: 'Manually added — completed prior to system' }
    memberSearch.value = ''
    showMemberDropdown.value = false
    showEnrollModal.value = true
}

function openAddEnrollment() {
    editingEnrollment.value = null
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    enrollForm.value = { user_id: '', program_id: null, date_started: localToday, date_ended: '', is_active: 'Y', approval_status: 'approved', remarks: '' }
    memberSearch.value = ''
    showMemberDropdown.value = false
    showEnrollModal.value = true
}

function openEditEnrollment(e: Enrollment) {
    editingEnrollment.value = e
    enrollForm.value = {
        user_id: e.user_id,
        program_id: e.program_id,
        date_started: e.date_started ?? '',
        date_ended: e.date_ended ?? '',
        is_active: e.is_active ?? 'Y',
        approval_status: e.approval_status ?? 'approved',
        remarks: e.remarks ?? '',
    }
    memberSearch.value = getMemberName(e.user_id)
    showMemberDropdown.value = false
    showEnrollModal.value = true
}

async function handleSaveEnrollment() {
    if (!enrollForm.value.user_id || !enrollForm.value.program_id) return
    enrollSaving.value = true
    message.value = null

    const program = programs.value.find(p => p.id === enrollForm.value.program_id)

    const payload = {
        user_id: enrollForm.value.user_id,
        program_id: enrollForm.value.program_id,
        program_type: program?.type ?? null,
        date_started: enrollForm.value.date_started || null,
        date_ended: enrollForm.value.date_ended || null,
        is_active: enrollForm.value.is_active,
        approval_status: enrollForm.value.approval_status,
        remarks: enrollForm.value.remarks.trim() || null,
    }

    if (editingEnrollment.value) {
        const { error } = await supabase
            .from('tbl_program_involvements')
            .update(payload)
            .eq('id', editingEnrollment.value.id)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Enrollment updated.' }
        }
    } else {
        const { error } = await supabase
            .from('tbl_program_involvements')
            .insert(payload)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Member enrolled successfully.' }
        }
    }

    enrollSaving.value = false
    if (message.value?.type === 'success') {
        showEnrollModal.value = false
        await fetchEnrollments()
    }
}

// ── Helpers ──

function getMemberName(userId: string | null) {
    if (!userId) return '—'
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function getProgramName(programId: number | null) {
    if (!programId) return '—'
    const p = programs.value.find(p => p.id === programId)
    return p?.type ?? '—'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDuration(startDate: string | null, endDate: string | null) {
    if (!startDate) return '—'
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    if (days >= 365) {
        const years = Math.floor(days / 365)
        const remaining = days % 365
        const months = Math.floor(remaining / 30)
        return months > 0 ? `${years}y ${months}mo` : `${years}y`
    }
    if (days >= 30) {
        const months = Math.floor(days / 30)
        const remaining = days % 30
        return remaining > 0 ? `${months}mo ${remaining}d` : `${months}mo`
    }
    return `${days}d`
}
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h1 class="text-2xl font-heading font-bold text-navy">Programs</h1>
            <button
                v-if="activeTab === 'library'"
                class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAddProgram"
            >
                + Add Program
            </button>
            <div v-else class="flex items-center gap-2">
                <button
                    v-if="auth.roleType === 'super_admin'"
                    class="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    @click="openAddCompleted"
                >
                    + Add Completed
                </button>
                <button
                    class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                    @click="openAddEnrollment"
                >
                    + Enroll Member
                </button>
            </div>
        </div>

        <!-- Tabs -->
        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-6">
            <button
                v-for="tab in [
                    { key: 'library' as const, label: 'Programs Library' },
                    { key: 'enrollments' as const, label: 'Enrollments' },
                ]"
                :key="tab.key"
                class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <!-- Search -->
        <div class="mb-4">
            <input
                v-model="search"
                type="text"
                :placeholder="activeTab === 'library' ? 'Search programs...' : 'Search by member or program...'"
                class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Programs Library Tab -->
        <template v-else-if="activeTab === 'library'">
            <div v-if="!filteredPrograms.length" class="text-center py-12 text-gray-400">No programs found.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Program</th>
                                <th class="px-4 py-3 hidden sm:table-cell">Description</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Started</th>
                                <th class="px-4 py-3">Duration</th>
                                <th class="px-4 py-3">Enrolled</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="p in filteredPrograms" :key="p.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 font-medium text-gray-900">
                                    <button class="hover:text-navy hover:underline text-left" @click="router.push({ name: 'admin-program-detail', params: { id: p.id } })">
                                        {{ p.type }}
                                    </button>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">
                                    <span class="line-clamp-1">{{ p.description ?? '—' }}</span>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(p.date_started) }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs font-medium text-gray-600">
                                        {{ p.duration_days ? `${p.duration_days}d` : '—' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">
                                        {{ getEnrolledCount(p.id) }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="p.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
                                    >
                                        {{ p.is_active ? 'Active' : 'Inactive' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <button
                                            class="text-xs text-navy hover:underline"
                                            @click="openEditProgram(p)"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            class="text-xs hover:underline"
                                            :class="p.is_active ? 'text-red-500' : 'text-green-600'"
                                            @click="toggleProgramActive(p)"
                                        >
                                            {{ p.is_active ? 'Deactivate' : 'Activate' }}
                                        </button>
                                        <button
                                            class="text-xs text-red-500 hover:underline"
                                            @click="openDeleteProgram(p)"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Enrollments Tab -->
        <template v-else>
            <div v-if="!filteredEnrollments.length" class="text-center py-12 text-gray-400">No enrollments found.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Member</th>
                                <th class="px-4 py-3">Program</th>
                                <th class="px-4 py-3 hidden sm:table-cell">Date Started</th>
                                <th class="px-4 py-3 hidden md:table-cell">Date Ended</th>
                                <th class="px-4 py-3">Duration</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="e in filteredEnrollments" :key="e.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 font-medium text-gray-900">{{ getMemberName(e.user_id) }}</td>
                                <td class="px-4 py-3 text-gray-900">{{ getProgramName(e.program_id) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">{{ formatDate(e.date_started) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ formatDate(e.date_ended) }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs font-medium text-gray-600">{{ getDuration(e.date_started, e.date_ended) }}</span>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="{
                                            'bg-amber-100 text-amber-700': e.approval_status === 'pending',
                                            'bg-red-50 text-red-600': e.approval_status === 'rejected',
                                            'bg-green-50 text-green-700': e.approval_status !== 'pending' && e.approval_status !== 'rejected' && e.is_active === 'Y',
                                            'bg-gray-100 text-gray-500': e.approval_status !== 'pending' && e.approval_status !== 'rejected' && e.is_active !== 'Y',
                                        }"
                                    >
                                        {{ e.approval_status === 'pending' ? 'Pending' : e.approval_status === 'rejected' ? 'Rejected' : (e.is_active === 'Y' ? 'Active' : 'Ended') }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <button
                                            class="text-xs text-navy hover:underline"
                                            @click="openEditEnrollment(e)"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            class="text-xs text-red-500 hover:underline"
                                            @click="openDeleteEnrollment(e)"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Program Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showProgramModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showProgramModal = false" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div class="flex items-center justify-between mb-5">
                            <h3 class="font-heading font-semibold text-navy text-lg">
                                {{ editingProgram ? 'Edit Program' : 'Add Program' }}
                            </h3>
                            <button class="text-gray-400 hover:text-gray-600" @click="showProgramModal = false">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form @submit.prevent="handleSaveProgram" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
                                <input
                                    v-model="programForm.type"
                                    required
                                    type="text"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    placeholder="e.g. School of Leaders"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    v-model="programForm.description"
                                    rows="3"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                                    placeholder="Brief description..."
                                />
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Date Started</label>
                                    <input
                                        v-model="programForm.date_started"
                                        type="date"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                                    <input
                                        v-model.number="programForm.duration_days"
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 90"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    />
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <input
                                    v-model="programForm.is_active"
                                    type="checkbox"
                                    id="program-active"
                                    class="rounded border-gray-300 text-navy focus:ring-navy/30"
                                />
                                <label for="program-active" class="text-sm text-gray-700">Active</label>
                            </div>
                            <button
                                type="submit"
                                :disabled="programSaving"
                                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                            >
                                {{ programSaving ? 'Saving...' : (editingProgram ? 'Update Program' : 'Create Program') }}
                            </button>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Delete Confirmation Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteModal = false" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
                        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 class="font-heading font-semibold text-gray-900 text-lg mb-2">Confirm Delete</h3>
                        <p class="text-sm text-gray-500 mb-6">
                            Are you sure you want to delete <strong>{{ deleteTarget?.label }}</strong>? This action cannot be undone.
                        </p>
                        <div class="flex gap-3">
                            <button
                                class="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                @click="showDeleteModal = false"
                            >
                                Cancel
                            </button>
                            <button
                                :disabled="deleting"
                                class="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                                @click="handleDelete"
                            >
                                {{ deleting ? 'Deleting...' : 'Delete' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <!-- Enrollment Modal -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showEnrollModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showEnrollModal = false" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div class="flex items-center justify-between mb-5">
                            <h3 class="font-heading font-semibold text-navy text-lg">
                                {{ editingEnrollment ? 'Edit Enrollment' : 'Enroll Member' }}
                            </h3>
                            <button class="text-gray-400 hover:text-gray-600" @click="showEnrollModal = false">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form @submit.prevent="handleSaveEnrollment" class="space-y-4">
                            <div class="relative">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                                <input
                                    v-model="memberSearch"
                                    type="text"
                                    placeholder="Search by name or email..."
                                    :disabled="!!editingEnrollment"
                                    @focus="showMemberDropdown = true"
                                    @blur="hideMemberDropdown"
                                    required
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:bg-gray-50 disabled:text-gray-500"
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
                                <label class="block text-sm font-medium text-gray-700 mb-1">Program</label>
                                <select
                                    v-model="enrollForm.program_id"
                                    required
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                >
                                    <option :value="null" disabled>Select program</option>
                                    <option
                                        v-for="p in programs.filter(p => p.is_active)"
                                        :key="p.id"
                                        :value="p.id"
                                    >
                                        {{ p.type }}
                                    </option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Date Started</label>
                                    <input
                                        v-model="enrollForm.date_started"
                                        type="date"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Date Ended</label>
                                    <input
                                        v-model="enrollForm.date_ended"
                                        type="date"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    />
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        v-model="enrollForm.is_active"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    >
                                        <option value="Y">Active</option>
                                        <option value="N">Ended</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Approval</label>
                                    <select
                                        v-model="enrollForm.approval_status"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                <input
                                    v-model="enrollForm.remarks"
                                    type="text"
                                    placeholder="Optional notes..."
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                            <button
                                type="submit"
                                :disabled="enrollSaving"
                                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                            >
                                {{ enrollSaving ? 'Saving...' : (editingEnrollment ? 'Update Enrollment' : 'Enroll Member') }}
                            </button>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
