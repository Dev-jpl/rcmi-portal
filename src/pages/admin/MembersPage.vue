<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'
import * as XLSX from 'xlsx'
import type { Tables } from '@/types/database.types'

type MembersProfile = Tables<'tbl_members_profile'>

const admin = useAdminStore()
const router = useRouter()

const search = ref('')
const statusFilter = ref('')
const churchFilter = ref<number | null>(null)
const lastAttendance = ref<Map<string, string>>(new Map())
const rejectTarget = ref<MembersProfile | null>(null)
const showRejectModal = ref(false)
const deleteTarget = ref<MembersProfile | null>(null)
const showDeleteModal = ref(false)
const actionLoading = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const showAddModal = ref(false)
const addLoading = ref(false)
const addError = ref('')
const addForm = ref({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    satelliteChurchId: null as number | null,
})

const churches = ref<{ id: number; church_name: string }[]>([])

onMounted(async () => {
    await Promise.all([admin.fetchMembers(), fetchChurches(), fetchLastAttendance()])
})

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
}

async function fetchLastAttendance() {
    const { data } = await supabase
        .from('tbl_attendance_logs')
        .select('user_id, log_date')
        .order('log_date', { ascending: false })

    if (!data) return
    const map = new Map<string, string>()
    for (const row of data) {
        if (!map.has(row.user_id)) {
            map.set(row.user_id, row.log_date)
        }
    }
    lastAttendance.value = map
}

function isInactive(userId: string): boolean {
    const last = lastAttendance.value.get(userId)
    if (!last) return true
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    return last < thirtyDaysAgo
}

const filtered = computed(() => {
    let list = admin.members
    const q = search.value.toLowerCase()
    if (q) {
        list = list.filter(
            (m) =>
                m.first_name?.toLowerCase().includes(q) ||
                m.last_name?.toLowerCase().includes(q) ||
                m.email?.toLowerCase().includes(q),
        )
    }
    if (statusFilter.value === 'inactive') {
        list = list.filter((m) => m.status === 'approved' && isInactive(m.user_id))
    } else if (statusFilter.value) {
        list = list.filter((m) => m.status === statusFilter.value)
    }
    if (churchFilter.value) {
        list = list.filter((m) => m.satellite_church_id === churchFilter.value)
    }
    return list
})

async function handleApprove(member: MembersProfile) {
    actionLoading.value = member.id
    message.value = null
    const result = await admin.approveMember(member)
    if (result.success) {
        message.value = { type: 'success', text: `${member.first_name} ${member.last_name} approved.` }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Failed to approve.' }
    }
    actionLoading.value = null
}

function openReject(member: MembersProfile) {
    rejectTarget.value = member
    showRejectModal.value = true
}

async function handleReject() {
    if (!rejectTarget.value) return
    actionLoading.value = rejectTarget.value.id
    message.value = null
    const result = await admin.rejectMember(rejectTarget.value)
    if (result.success) {
        message.value = { type: 'success', text: `${rejectTarget.value.first_name} rejected and account removed.` }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Failed to reject.' }
    }
    showRejectModal.value = false
    actionLoading.value = null
}

function exportToExcel() {
    const rows = filtered.value.map((m) => ({
        'First Name': m.first_name ?? '',
        'Last Name': m.last_name ?? '',
        Email: m.email ?? '',
        Status: m.status ?? '',
        Church: m.satellite_church_name ?? '',
        'Date Joined': m.created_at ? new Date(m.created_at).toLocaleDateString() : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Members')
    XLSX.writeFile(wb, 'members.xlsx')
}

function viewMember(m: MembersProfile) {
    router.push({ name: 'admin-member-detail', params: { id: m.user_id } })
}

function openDelete(member: MembersProfile) {
    deleteTarget.value = member
    showDeleteModal.value = true
}

async function handleDelete() {
    if (!deleteTarget.value) return
    actionLoading.value = deleteTarget.value.id
    message.value = null
    const result = await admin.deleteMember(deleteTarget.value)
    if (result.success) {
        message.value = { type: 'success', text: `${deleteTarget.value.first_name} ${deleteTarget.value.last_name} deleted.` }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Failed to delete.' }
    }
    showDeleteModal.value = false
    deleteTarget.value = null
    actionLoading.value = null
}

function openAdd() {
    addForm.value = {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        satelliteChurchId: admin.getChurchScope(),
    }
    addError.value = ''
    showAddModal.value = true
}

async function handleAdd() {
    addError.value = ''
    const f = addForm.value
    if (!f.firstName.trim() || !f.lastName.trim() || !f.email.trim() || !f.password || !f.satelliteChurchId) {
        addError.value = 'Please complete all fields.'
        return
    }
    if (f.password.length < 6) {
        addError.value = 'Password must be at least 6 characters.'
        return
    }

    addLoading.value = true
    const church = churches.value.find((c) => c.id === f.satelliteChurchId)
    const result = await admin.addMember({
        email: f.email.trim(),
        password: f.password,
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        satelliteChurchId: f.satelliteChurchId,
        satelliteChurchName: church?.church_name,
    })
    addLoading.value = false

    if (result.success) {
        message.value = { type: 'success', text: `${f.firstName} ${f.lastName} added and approved.` }
        showAddModal.value = false
    } else {
        addError.value = result.error ?? 'Failed to add member.'
    }
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
                <h1 class="text-2xl font-heading font-bold text-navy">Members</h1>
                <p class="text-sm text-gray-500 mt-1">{{ filtered.length }} member{{ filtered.length !== 1 ? 's' : '' }}</p>
            </div>
            <div class="flex items-center gap-2">
                <button
                    class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                    @click="openAdd"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                    Add Member
                </button>
                <button
                    class="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    @click="exportToExcel"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export Excel
                </button>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search name or email..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
            <select
                v-model="statusFilter"
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive (30d+)</option>
            </select>
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
        <div v-if="admin.loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">
            No members found.
        </div>

        <!-- Table -->
        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Name</th>
                            <th class="px-4 py-3 hidden md:table-cell">Email</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Church</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3 hidden md:table-cell">Joined</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr
                            v-for="m in filtered"
                            :key="m.id"
                            class="hover:bg-gray-50/50 cursor-pointer"
                            @click="viewMember(m)"
                        >
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center text-xs font-bold text-navy shrink-0 overflow-hidden">
                                        <img v-if="m.profile_photo_url" :src="m.profile_photo_url" :alt="`${m.first_name} ${m.last_name}`" class="w-full h-full object-cover" />
                                        <span v-else>{{ (m.first_name?.[0] ?? '') + (m.last_name?.[0] ?? '') }}</span>
                                    </div>
                                    <div class="min-w-0">
                                        <span class="font-medium text-gray-900">{{ m.first_name }} {{ m.last_name }}</span>
                                        <p class="text-xs text-gray-400 md:hidden truncate">{{ m.email }}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ m.email }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ m.satellite_church_name ?? '—' }}</td>
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-1.5">
                                    <span
                                        class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                                        :class="{
                                            'bg-green-100 text-green-700': m.status === 'approved',
                                            'bg-yellow-100 text-yellow-700': m.status === 'pending',
                                            'bg-red-100 text-red-600': m.status === 'rejected',
                                        }"
                                    >
                                        {{ m.status }}
                                    </span>
                                    <span
                                        v-if="m.status === 'approved' && isInactive(m.user_id)"
                                        class="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-600"
                                        title="No attendance in 30+ days"
                                    >
                                        Inactive
                                    </span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{{ formatDate(m.created_at) }}</td>
                            <td class="px-4 py-3 text-right" @click.stop>
                                <template v-if="m.status === 'pending'">
                                    <button
                                        :disabled="actionLoading === m.id"
                                        class="text-green-600 hover:text-green-700 text-sm font-medium mr-3"
                                        @click="handleApprove(m)"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        :disabled="actionLoading === m.id"
                                        class="text-red-500 hover:text-red-600 text-sm font-medium"
                                        @click="openReject(m)"
                                    >
                                        Reject
                                    </button>
                                </template>
                                <template v-else>
                                    <button
                                        class="text-navy hover:text-navy-600 text-sm font-medium mr-3"
                                        @click="viewMember(m)"
                                    >
                                        View
                                    </button>
                                    <button
                                        class="text-red-400 hover:text-red-600 text-sm font-medium"
                                        @click="openDelete(m)"
                                    >
                                        Delete
                                    </button>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add Member Modal -->
        <Teleport to="body">
            <div
                v-if="showAddModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showAddModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-1">Add Member</h3>
                    <p class="text-sm text-gray-500 mb-4">
                        Creates an approved account. Share the email and password with the member so they can sign in.
                    </p>

                    <form class="space-y-3" @submit.prevent="handleAdd">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                                <input
                                    v-model="addForm.firstName"
                                    type="text"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                                />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                                <input
                                    v-model="addForm.lastName"
                                    type="text"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Email</label>
                            <input
                                v-model="addForm.email"
                                type="email"
                                autocomplete="off"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Temporary Password</label>
                            <input
                                v-model="addForm.password"
                                type="text"
                                autocomplete="off"
                                placeholder="At least 6 characters"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Satellite Church</label>
                            <select
                                v-model="addForm.satelliteChurchId"
                                :disabled="!admin.isSuperAdmin"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option :value="null" disabled>Select a church</option>
                                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                            </select>
                        </div>

                        <p v-if="addError" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ addError }}</p>

                        <div class="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                                @click="showAddModal = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="addLoading"
                                class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ addLoading ? 'Adding...' : 'Add Member' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- Reject Modal -->
        <Teleport to="body">
            <div
                v-if="showRejectModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showRejectModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-3">Reject Member</h3>
                    <p class="text-sm text-gray-600 mb-2">
                        Reject <strong>{{ rejectTarget?.first_name }} {{ rejectTarget?.last_name }}</strong>?
                    </p>
                    <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                        This permanently deletes their account and sign-in — they would need to register again. This cannot be undone.
                    </p>
                    <div class="flex justify-end gap-3 mt-4">
                        <button
                            :disabled="actionLoading === rejectTarget?.id"
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showRejectModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="actionLoading === rejectTarget?.id"
                            class="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50"
                            @click="handleReject"
                        >
                            {{ actionLoading === rejectTarget?.id ? 'Removing...' : 'Reject & Remove' }}
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
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-heading font-bold text-gray-900">Delete Member Profile</h3>
                            <p class="text-sm text-gray-500">This removes the duplicate profile.</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-5">
                        Are you sure you want to delete <strong>{{ deleteTarget?.first_name }} {{ deleteTarget?.last_name }}</strong>'s profile? This action cannot be undone.
                    </p>
                    <div class="flex justify-end gap-3">
                        <button
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showDeleteModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="actionLoading === deleteTarget?.id"
                            class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            @click="handleDelete"
                        >
                            {{ actionLoading === deleteTarget?.id ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
