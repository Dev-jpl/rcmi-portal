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
</script>

<template>
    <div>
        <button class="text-sm text-gray-500 hover:text-navy mb-4 inline-flex items-center gap-1" @click="router.back()">
            &larr; Back to Members
        </button>

        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-32 bg-gray-200 rounded-xl animate-pulse" />
            <div class="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>

        <template v-else-if="profile">
            <!-- Profile header -->
            <div class="bg-white rounded-xl border border-gray-200 p-6 mb-6">
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
                <div class="bg-white rounded-xl border border-gray-200 p-5">
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
                <div class="bg-white rounded-xl border border-gray-200 p-5">
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
            <div class="bg-white rounded-xl border border-gray-200 p-5 mt-6">
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
    </div>
</template>
