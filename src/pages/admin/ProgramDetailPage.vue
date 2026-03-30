<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'
import { useAuthStore } from '@/stores/auth.store'

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
    approved_by: string | null
    approved_at: string | null
    remarks: string | null
}

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()
const auth = useAuthStore()

const programId = Number(route.params.id)
const program = ref<Program | null>(null)
const enrollments = ref<Enrollment[]>([])
const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const filterStatus = ref<'all' | 'pending' | 'active' | 'ended'>('all')

// Enroll modal
const showEnrollModal = ref(false)
const editingEnrollment = ref<Enrollment | null>(null)
const enrollForm = ref({ user_id: '', date_started: '', date_ended: '', is_active: 'Y', approval_status: 'approved', remarks: '' })
const enrollSaving = ref(false)

onMounted(async () => {
    await Promise.all([fetchProgram(), fetchEnrollments(), admin.fetchMembers()])
    loading.value = false
})

async function fetchProgram() {
    const { data } = await supabase
        .from('lib_programs')
        .select('*')
        .eq('id', programId)
        .maybeSingle()
    program.value = data as Program | null
}

async function fetchEnrollments() {
    const { data } = await supabase
        .from('tbl_program_involvements')
        .select('*')
        .eq('program_id', programId)
        .order('created_at', { ascending: false })
    enrollments.value = (data ?? []) as Enrollment[]
}

// Stats
const totalEnrolled = computed(() => enrollments.value.length)
const pendingCount = computed(() => enrollments.value.filter(e => e.approval_status === 'pending').length)
const activeCount = computed(() => enrollments.value.filter(e => e.is_active === 'Y' && e.approval_status !== 'pending').length)
const completedCount = computed(() => enrollments.value.filter(e => e.is_active === 'N' || e.date_ended).length)

const filtered = computed(() => {
    let list = enrollments.value

    if (filterStatus.value === 'pending') {
        list = list.filter(e => e.approval_status === 'pending')
    } else if (filterStatus.value === 'active') {
        list = list.filter(e => e.is_active === 'Y' && !e.date_ended && e.approval_status !== 'pending')
    } else if (filterStatus.value === 'ended') {
        list = list.filter(e => e.is_active === 'N' || e.date_ended)
    }

    const q = search.value.toLowerCase()
    if (q) {
        list = list.filter(e => getMemberName(e.user_id).toLowerCase().includes(q))
    }

    return list
})

// Approval actions
const approvingId = ref<number | null>(null)

async function handleApprove(e: Enrollment) {
    approvingId.value = e.id
    const { error } = await supabase
        .from('tbl_program_involvements')
        .update({
            approval_status: 'approved',
            approved_by: auth.session?.user?.id ?? null,
            approved_at: new Date().toISOString(),
        })
        .eq('id', e.id)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `Enrollment approved for ${getMemberName(e.user_id)}.` }
        await fetchEnrollments()
    }
    approvingId.value = null
}

async function handleReject(e: Enrollment) {
    approvingId.value = e.id
    const { error } = await supabase
        .from('tbl_program_involvements')
        .update({
            approval_status: 'rejected',
            is_active: 'N',
            approved_by: auth.session?.user?.id ?? null,
            approved_at: new Date().toISOString(),
        })
        .eq('id', e.id)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `Enrollment rejected for ${getMemberName(e.user_id)}.` }
        await fetchEnrollments()
    }
    approvingId.value = null
}

// Add completed (super_admin only — backtrack old completions)
function openAddCompleted() {
    editingEnrollment.value = null
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    enrollForm.value = {
        user_id: '',
        date_started: '',
        date_ended: localToday,
        is_active: 'N',
        approval_status: 'approved',
        remarks: 'Manually added — completed prior to system',
    }
    showEnrollModal.value = true
}

// Enroll modal
function openAddEnrollment() {
    editingEnrollment.value = null
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    enrollForm.value = { user_id: '', date_started: localToday, date_ended: '', is_active: 'Y', approval_status: 'approved', remarks: '' }
    showEnrollModal.value = true
}

function openEditEnrollment(e: Enrollment) {
    editingEnrollment.value = e
    enrollForm.value = {
        user_id: e.user_id,
        date_started: e.date_started ?? '',
        date_ended: e.date_ended ?? '',
        is_active: e.is_active ?? 'Y',
        approval_status: e.approval_status ?? 'approved',
        remarks: e.remarks ?? '',
    }
    showEnrollModal.value = true
}

async function handleSaveEnrollment() {
    if (!enrollForm.value.user_id) return
    enrollSaving.value = true
    message.value = null

    const payload: Record<string, any> = {
        user_id: enrollForm.value.user_id,
        program_id: programId,
        program_type: program.value?.type ?? null,
        date_started: enrollForm.value.date_started || null,
        date_ended: enrollForm.value.date_ended || null,
        is_active: enrollForm.value.is_active,
        approval_status: enrollForm.value.approval_status,
        remarks: enrollForm.value.remarks.trim() || null,
    }

    // If admin is approving via form, stamp it
    if (enrollForm.value.approval_status === 'approved' && editingEnrollment.value?.approval_status !== 'approved') {
        payload.approved_by = auth.session?.user?.id ?? null
        payload.approved_at = new Date().toISOString()
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
        // Check if member is already enrolled
        const existing = enrollments.value.find(e => e.user_id === enrollForm.value.user_id && e.is_active === 'Y')
        if (existing) {
            message.value = { type: 'error', text: 'Member is already enrolled in this program.' }
            enrollSaving.value = false
            return
        }

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

// Helpers
function getMemberName(userId: string | null) {
    if (!userId) return '—'
    const m = admin.members.find(m => m.user_id === userId)
    return m ? `${m.first_name} ${m.last_name}` : '—'
}

function getElapsedDays(startDate: string | null, endDate: string | null): number {
    if (!startDate) return 0
    const start = new Date(startDate)
    const end = endDate ? new Date(endDate) : new Date()
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
}

function progressPercent(e: Enrollment): number {
    const total = program.value?.duration_days
    if (!total || !e.date_started) return 0
    const elapsed = getElapsedDays(e.date_started, e.date_ended)
    return Math.min(100, Math.round((elapsed / total) * 100))
}

function formatDuration(days: number): string {
    if (days >= 365) {
        const y = Math.floor(days / 365)
        const m = Math.floor((days % 365) / 30)
        return m > 0 ? `${y}y ${m}mo` : `${y}y`
    }
    if (days >= 30) {
        const m = Math.floor(days / 30)
        const d = days % 30
        return d > 0 ? `${m}mo ${d}d` : `${m}mo`
    }
    return `${days}d`
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div>
        <!-- Back + Header -->
        <div class="mb-6">
            <button
                class="text-sm text-gray-500 hover:text-navy mb-3 flex items-center gap-1"
                @click="router.push({ name: 'admin-programs' })"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Programs
            </button>

            <div v-if="loading" class="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
            <template v-else-if="program">
                <div class="flex items-start justify-between flex-wrap gap-3">
                    <div>
                        <h1 class="text-2xl font-heading font-bold text-navy">{{ program.type }}</h1>
                        <p v-if="program.description" class="text-sm text-gray-500 mt-1">{{ program.description }}</p>
                        <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span v-if="program.date_started">Started {{ formatDate(program.date_started) }}</span>
                            <span v-if="program.duration_days" class="flex items-center gap-1">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {{ program.duration_days }} days duration
                            </span>
                            <span
                                class="px-2 py-0.5 rounded-full font-medium"
                                :class="program.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
                            >
                                {{ program.is_active ? 'Active' : 'Inactive' }}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
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
            </template>
            <div v-else class="text-gray-400">Program not found.</div>
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
        <div v-if="!loading && program" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div class="bg-white rounded-lg p-3 border border-gray-200">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
                <p class="text-2xl font-heading font-bold text-navy">{{ totalEnrolled }}</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200" :class="pendingCount > 0 ? 'border-amber-300 bg-amber-50/50' : ''">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Pending</p>
                <p class="text-2xl font-heading font-bold" :class="pendingCount > 0 ? 'text-amber-600' : 'text-gray-400'">{{ pendingCount }}</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Active</p>
                <p class="text-2xl font-heading font-bold text-green-600">{{ activeCount }}</p>
            </div>
            <div class="bg-white rounded-lg p-3 border border-gray-200">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">Completed</p>
                <p class="text-2xl font-heading font-bold text-gray-500">{{ completedCount }}</p>
            </div>
        </div>

        <!-- Filter + Search -->
        <div v-if="!loading && program" class="flex items-center gap-3 mb-4 flex-wrap">
            <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                <button
                    v-for="f in [
                        { key: 'all' as const, label: 'All' },
                        { key: 'pending' as const, label: 'Pending' },
                        { key: 'active' as const, label: 'Active' },
                        { key: 'ended' as const, label: 'Ended' },
                    ]"
                    :key="f.key"
                    class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                    :class="filterStatus === f.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                    @click="filterStatus = f.key"
                >
                    {{ f.label }}
                </button>
            </div>
            <input
                v-model="search"
                type="text"
                placeholder="Search member..."
                class="flex-1 min-w-0 sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Enrollments Table -->
        <template v-else-if="program">
            <div v-if="!filtered.length" class="text-center py-12 text-gray-400">No enrollments found.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Member</th>
                                <th class="px-4 py-3">Date Started</th>
                                <th class="px-4 py-3 hidden sm:table-cell">Date Ended</th>
                                <th class="px-4 py-3">Duration</th>
                                <th v-if="program.duration_days" class="px-4 py-3 hidden md:table-cell">Progress</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="e in filtered" :key="e.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 font-medium text-gray-900">{{ getMemberName(e.user_id) }}</td>
                                <td class="px-4 py-3 text-gray-500">{{ formatDate(e.date_started) }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">{{ formatDate(e.date_ended) }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs font-medium text-gray-600">
                                        {{ e.date_started ? formatDuration(getElapsedDays(e.date_started, e.date_ended)) : '—' }}
                                    </span>
                                </td>
                                <td v-if="program.duration_days" class="px-4 py-3 hidden md:table-cell">
                                    <div class="flex items-center gap-2">
                                        <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                class="h-full rounded-full transition-all"
                                                :class="progressPercent(e) >= 100 ? 'bg-green-500' : 'bg-navy'"
                                                :style="{ width: progressPercent(e) + '%' }"
                                            />
                                        </div>
                                        <span class="text-xs text-gray-500">{{ progressPercent(e) }}%</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="{
                                            'bg-amber-100 text-amber-700': e.approval_status === 'pending',
                                            'bg-red-50 text-red-600': e.approval_status === 'rejected',
                                            'bg-green-50 text-green-700': e.approval_status !== 'pending' && e.approval_status !== 'rejected' && e.is_active === 'Y' && !e.date_ended,
                                            'bg-blue-50 text-blue-700': e.approval_status !== 'pending' && e.is_active === 'Y' && e.date_ended,
                                            'bg-gray-100 text-gray-500': e.approval_status !== 'pending' && e.approval_status !== 'rejected' && e.is_active === 'N' && !e.date_ended,
                                        }"
                                    >
                                        {{ e.approval_status === 'pending' ? 'Pending' : e.approval_status === 'rejected' ? 'Rejected' : e.date_ended ? 'Completed' : (e.is_active === 'Y' ? 'Active' : 'Ended') }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        <!-- Approval actions for pending -->
                                        <template v-if="e.approval_status === 'pending'">
                                            <button
                                                :disabled="approvingId === e.id"
                                                class="text-xs text-green-600 hover:underline font-medium"
                                                @click="handleApprove(e)"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                :disabled="approvingId === e.id"
                                                class="text-xs text-red-500 hover:underline"
                                                @click="handleReject(e)"
                                            >
                                                Reject
                                            </button>
                                        </template>
                                        <button class="text-xs text-navy hover:underline" @click="openEditEnrollment(e)">
                                            Edit
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

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
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Member</label>
                                <select
                                    v-model="enrollForm.user_id"
                                    required
                                    :disabled="!!editingEnrollment"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 disabled:bg-gray-50 disabled:text-gray-500"
                                >
                                    <option value="" disabled>Select member</option>
                                    <option
                                        v-for="m in admin.members.filter(m => m.status === 'approved')"
                                        :key="m.user_id"
                                        :value="m.user_id"
                                    >
                                        {{ m.first_name }} {{ m.last_name }}
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
                                {{ enrollSaving ? 'Saving...' : (editingEnrollment ? 'Update' : 'Enroll Member') }}
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
