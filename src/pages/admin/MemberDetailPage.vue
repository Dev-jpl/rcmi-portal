<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin.store'
import type { Tables } from '@/types/database.types'

type MembersProfile = Tables<'tbl_members_profile'>
type TblUser = Tables<'tbl_users'>
type AttendanceLog = Tables<'tbl_attendance_logs'>
type MinistryInvolvement = Tables<'tbl_ministry_involvements'>

const route = useRoute()
const router = useRouter()
const admin = useAdminStore()

const profile = ref<MembersProfile | null>(null)
const user = ref<TblUser | null>(null)
const attendance = ref<AttendanceLog[]>([])
const ministries = ref<MinistryInvolvement[]>([])
const loading = ref(true)

const userId = route.params.id as string

onMounted(async () => {
    const [memberData, attData, minData] = await Promise.all([
        admin.fetchMemberById(userId),
        admin.fetchMemberAttendance(userId),
        admin.fetchMemberMinistries(userId),
    ])
    profile.value = memberData.profile
    user.value = memberData.user
    attendance.value = attData
    ministries.value = minData
    loading.value = false
})

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

const statusColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-600',
}

// ── Edit / Delete ─────────────────────────────────────────────
const showEdit = ref(false)
const showDelete = ref(false)
const editLoading = ref(false)
const deleteLoading = ref(false)
const actionError = ref('')
const editForm = ref({ firstName: '', middleName: '', lastName: '', isAdmin: false })

function openEdit() {
    if (!profile.value) return
    editForm.value = {
        firstName: profile.value.first_name ?? '',
        middleName: profile.value.middle_name ?? '',
        lastName: profile.value.last_name ?? '',
        isAdmin: ['admin', 'super_admin'].includes(user.value?.role_type ?? ''),
    }
    actionError.value = ''
    showEdit.value = true
}

async function handleEdit() {
    if (!profile.value) return
    if (!editForm.value.firstName.trim() || !editForm.value.lastName.trim()) {
        actionError.value = 'First and last name are required.'
        return
    }

    editLoading.value = true
    actionError.value = ''

    const uid = profile.value.user_id
    const infoRes = await admin.updateMemberInfo(uid, {
        first_name: editForm.value.firstName.trim(),
        middle_name: editForm.value.middleName.trim() || null,
        last_name: editForm.value.lastName.trim(),
    })

    const currentRole = user.value?.role_type ?? 'member'
    const currentlyAdmin = currentRole === 'admin'
    const roleChanged =
        admin.isSuperAdmin && currentRole !== 'super_admin' && editForm.value.isAdmin !== currentlyAdmin

    let roleRes: { success: boolean; error?: string } = { success: true }
    if (infoRes.success && roleChanged) {
        roleRes = await admin.setMemberRole(uid, editForm.value.isAdmin ? 'admin' : 'member')
    }

    editLoading.value = false

    if (infoRes.success && roleRes.success) {
        // Reflect changes locally without a refetch.
        profile.value = {
            ...profile.value,
            first_name: editForm.value.firstName.trim(),
            middle_name: editForm.value.middleName.trim() || null,
            last_name: editForm.value.lastName.trim(),
        }
        if (roleChanged && user.value) {
            user.value = { ...user.value, role_type: editForm.value.isAdmin ? 'admin' : 'member' }
        }
        showEdit.value = false
    } else {
        actionError.value = infoRes.error ?? roleRes.error ?? 'Failed to update member.'
    }
}

async function handleDelete() {
    if (!profile.value) return
    deleteLoading.value = true
    actionError.value = ''
    const res = await admin.deleteMember(profile.value)
    deleteLoading.value = false
    if (res.success) {
        router.push({ name: 'admin-members' })
    } else {
        actionError.value = res.error ?? 'Failed to delete member.'
        showDelete.value = false
    }
}
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-4">
            <button class="text-sm text-gray-500 hover:text-navy inline-flex items-center gap-1" @click="router.back()">
                &larr; Back to Members
            </button>
            <div v-if="profile" class="flex items-center gap-2">
                <button
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    @click="openEdit"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 19.5h-15" />
                    </svg>
                    Edit
                </button>
                <button
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                    @click="showDelete = true"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                </button>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-32 bg-gray-200 rounded-lg animate-pulse" />
            <div class="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <template v-else-if="profile">
            <!-- Profile header -->
            <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <div class="flex items-start gap-5">
                    <div class="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center text-xl font-bold text-navy shrink-0 overflow-hidden">
                        <img v-if="profile.profile_photo_url" :src="profile.profile_photo_url" class="w-full h-full object-cover" />
                        <template v-else>{{ (profile.first_name?.[0] ?? '') + (profile.last_name?.[0] ?? '') }}</template>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-3 mb-1">
                            <h1 class="text-2xl font-heading font-bold text-navy">
                                {{ profile.first_name }} {{ profile.middle_name ?? '' }} {{ profile.last_name }} {{ profile.ext_name ?? '' }}
                            </h1>
                            <span
                                class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                                :class="statusColors[profile.status ?? ''] ?? 'bg-gray-100 text-gray-500'"
                            >
                                {{ profile.status }}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500">{{ profile.email }}</p>
                        <div class="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                            <span>Church: <strong>{{ profile.satellite_church_name ?? '—' }}</strong></span>
                            <span>Role: <strong>{{ user?.role_type ?? '—' }}</strong></span>
                            <span>Joined: <strong>{{ formatDate(profile.created_at) }}</strong></span>
                            <span v-if="profile.birth_date">Birthday: <strong>{{ formatDate(profile.birth_date) }}</strong></span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid lg:grid-cols-2 gap-6">
                <!-- Network info -->
                <div class="bg-white rounded-lg border border-gray-200 p-5">
                    <h2 class="font-heading font-semibold text-navy mb-4">Network Info</h2>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Network</span>
                            <span class="font-medium text-gray-800">{{ profile.network_name ?? 'Not assigned' }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">QR Token</span>
                            <span class="font-mono text-xs text-gray-600">{{ profile.qr_token ?? 'None' }}</span>
                        </div>
                        <div v-if="profile.approved_at" class="flex justify-between">
                            <span class="text-gray-500">Approved</span>
                            <span class="font-medium text-gray-800">{{ formatDate(profile.approved_at) }}</span>
                        </div>
                        <div v-if="profile.rejected_reason" class="flex justify-between">
                            <span class="text-gray-500">Reject Reason</span>
                            <span class="font-medium text-red-600">{{ profile.rejected_reason }}</span>
                        </div>
                    </div>
                </div>

                <!-- Ministry involvements -->
                <div class="bg-white rounded-lg border border-gray-200 p-5">
                    <h2 class="font-heading font-semibold text-navy mb-4">Ministry Involvements</h2>
                    <div v-if="!ministries.length" class="text-sm text-gray-400 text-center py-4">No ministry records</div>
                    <div v-else class="space-y-2">
                        <div
                            v-for="m in ministries"
                            :key="m.id"
                            class="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm"
                        >
                            <div>
                                <p class="font-medium text-gray-800">{{ m.ministry_type }}</p>
                                <p class="text-xs text-gray-500">{{ m.ministry_role_title ?? 'Member' }}</p>
                            </div>
                            <span
                                class="text-xs px-2 py-0.5 rounded-full"
                                :class="m.is_active === 'Y' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                            >
                                {{ m.is_active === 'Y' ? 'Active' : 'Inactive' }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Attendance history -->
            <div class="bg-white rounded-lg border border-gray-200 p-5 mt-6">
                <h2 class="font-heading font-semibold text-navy mb-4">Attendance History</h2>
                <div v-if="!attendance.length" class="text-sm text-gray-400 text-center py-4">No attendance records</div>
                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Event</th>
                                <th class="px-4 py-3 hidden md:table-cell">Location</th>
                                <th class="px-4 py-3">Method</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="log in attendance.slice(0, 20)" :key="log.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 text-gray-900">{{ formatDate(log.log_date) }}</td>
                                <td class="px-4 py-3 font-medium text-gray-900">{{ log.event_title ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ log.logged_location_name ?? '—' }}</td>
                                <td class="px-4 py-3">
                                    <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                        {{ log.input_method }}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p v-if="attendance.length > 20" class="text-xs text-gray-400 mt-2 text-center">
                    Showing 20 of {{ attendance.length }} records
                </p>
            </div>
        </template>

        <div v-else class="text-center py-12 text-gray-400">Member not found.</div>

        <!-- Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showEdit"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showEdit = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">Edit Member</h3>

                    <form class="space-y-3" @submit.prevent="handleEdit">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                                <input
                                    v-model="editForm.firstName"
                                    type="text"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                                />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                                <input
                                    v-model="editForm.lastName"
                                    type="text"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Middle Name</label>
                            <input
                                v-model="editForm.middleName"
                                type="text"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Email</label>
                            <input
                                :value="profile?.email"
                                type="email"
                                disabled
                                class="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-lg text-sm"
                            />
                        </div>

                        <!-- Admin access (super_admin only) -->
                        <label
                            v-if="admin.isSuperAdmin"
                            class="flex items-start gap-2.5 cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5"
                            :class="{ 'opacity-60 cursor-not-allowed': (user?.role_type ?? '') === 'super_admin' }"
                        >
                            <input
                                v-model="editForm.isAdmin"
                                type="checkbox"
                                :disabled="(user?.role_type ?? '') === 'super_admin'"
                                class="w-4 h-4 mt-0.5 rounded border-gray-300 text-navy focus:ring-navy"
                            />
                            <span class="text-sm text-gray-700">
                                <span class="font-medium">Grant admin access</span>
                                <span class="block text-xs text-gray-400 mt-0.5">
                                    {{ (user?.role_type ?? '') === 'super_admin'
                                        ? 'This member is a super admin and cannot be changed here.'
                                        : 'Lets this member manage members, approvals and events for their church.' }}
                                </span>
                            </span>
                        </label>

                        <p v-if="actionError" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ actionError }}</p>

                        <div class="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                                @click="showEdit = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="editLoading"
                                class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ editLoading ? 'Saving...' : 'Save Changes' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- Delete Modal -->
        <Teleport to="body">
            <div
                v-if="showDelete"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showDelete = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-heading font-bold text-gray-900">Delete Member</h3>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">
                        Permanently delete <strong>{{ profile?.first_name }} {{ profile?.last_name }}</strong>?
                    </p>
                    <p class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-5">
                        This removes their account and sign-in entirely. This cannot be undone.
                    </p>
                    <p v-if="actionError" class="text-sm text-red-600 mb-3">{{ actionError }}</p>
                    <div class="flex justify-end gap-3">
                        <button
                            :disabled="deleteLoading"
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showDelete = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="deleteLoading"
                            class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            @click="handleDelete"
                        >
                            {{ deleteLoading ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
