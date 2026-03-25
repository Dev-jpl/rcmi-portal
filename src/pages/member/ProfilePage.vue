<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from 'chart.js'
import { useAuthStore } from '@/stores/auth.store'
import { useMemberStore } from '@/stores/member.store'
import { useAttendanceStore } from '@/stores/attendance.store'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const auth = useAuthStore()
const member = useMemberStore()
const attendance = useAttendanceStore()

const loading = ref(true)
const saving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const uploading = ref(false)
const editMode = ref(false)
const uploadingCover = ref(false)
const devotionStreak = ref(0)

interface MemberBadge {
    id: number
    name: string
    icon: string
    color: string
    count: number
}
const memberBadges = ref<MemberBadge[]>([])

const form = ref({
    first_name: '',
    middle_name: '',
    last_name: '',
    ext_name: '',
    email: '',
    birth_date: '',
    phone_number: '',
    satellite_church_id: null as number | null,
})

const churches = ref<{ id: number; church_name: string }[]>([])

onMounted(async () => {
    await Promise.all([
        member.fetchProfile(),
        member.fetchPrograms(),
        member.fetchNetworkProfile(),
        attendance.fetchMyLogs(),
        fetchChurches(),
        fetchDevotionStreak(),
        fetchMemberBadges(),
    ])
    populateForm()
    loading.value = false
})

watch(() => member.profile, populateForm)

function populateForm() {
    if (!member.profile) return
    form.value = {
        first_name: member.profile.first_name ?? '',
        middle_name: member.profile.middle_name ?? '',
        last_name: member.profile.last_name ?? '',
        ext_name: member.profile.ext_name ?? '',
        email: member.profile.email ?? '',
        birth_date: member.profile.birth_date ?? '',
        phone_number: (member.profile as any).phone_number ?? '',
        satellite_church_id: member.profile.satellite_church_id,
    }
}

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
}

async function fetchDevotionStreak() {
    if (!auth.session?.user) return

    // Get user's devotional posts ordered by date desc
    const { data } = await supabase
        .from('tbl_devotionals')
        .select('created_at')
        .eq('user_id', auth.session.user.id)
        .order('created_at', { ascending: false })
        .limit(365)

    if (!data?.length) { devotionStreak.value = 0; return }

    // Get unique dates (YYYY-MM-DD)
    const dates = [...new Set(data.map(d => d.created_at.split('T')[0]))].sort().reverse()

    // Count consecutive days from today (or yesterday if not posted today yet)
    const today = new Date().toISOString().split('T')[0]
    let streak = 0
    let checkDate = today

    for (const date of dates) {
        if (date === checkDate) {
            streak++
            // Move to previous day
            const prev = new Date(checkDate + 'T00:00:00')
            prev.setDate(prev.getDate() - 1)
            checkDate = prev.toISOString().split('T')[0]
        } else if (streak === 0 && date === (() => {
            const y = new Date(today + 'T00:00:00')
            y.setDate(y.getDate() - 1)
            return y.toISOString().split('T')[0]
        })()) {
            // Didn't post today but posted yesterday — start streak from yesterday
            streak = 1
            const prev = new Date(date + 'T00:00:00')
            prev.setDate(prev.getDate() - 1)
            checkDate = prev.toISOString().split('T')[0]
        } else {
            break
        }
    }

    devotionStreak.value = streak
}

async function fetchMemberBadges() {
    if (!auth.session?.user) return

    const { data } = await supabase
        .from('tbl_member_badges')
        .select('badge_id, lib_badges(id, name, icon, color)')
        .eq('member_id', auth.session.user.id)

    if (!data?.length) return

    // Group by badge and count tributes
    const counts = new Map<number, { badge: any; count: number }>()
    for (const row of data) {
        const badge = (row as any).lib_badges
        if (!badge) continue
        const existing = counts.get(badge.id)
        if (existing) {
            existing.count++
        } else {
            counts.set(badge.id, { badge, count: 1 })
        }
    }

    memberBadges.value = Array.from(counts.values())
        .map(({ badge, count }) => ({
            id: badge.id,
            name: badge.name,
            icon: badge.icon,
            color: badge.color,
            count,
        }))
        .sort((a, b) => b.count - a.count)
}

function badgeStyle(color: string) {
    const styles: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        violet: 'bg-violet-50 text-violet-700 border-violet-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
    return styles[color] ?? 'bg-gray-50 text-gray-700 border-gray-200'
}

function badgeEmoji(icon: string) {
    const emojis: Record<string, string> = {
        hand: '\u{1F91D}',
        pray: '\u{1F64F}',
        heart: '\u{2764}\u{FE0F}',
        star: '\u{2B50}',
        music: '\u{1F3B5}',
        sparkle: '\u{2728}',
    }
    return emojis[icon] ?? '\u{1F3C5}'
}

async function handleSave() {
    saving.value = true
    message.value = null

    const result = await member.updateProfile({
        first_name: form.value.first_name || null,
        middle_name: form.value.middle_name || null,
        last_name: form.value.last_name || null,
        ext_name: form.value.ext_name || null,
        birth_date: form.value.birth_date || null,
        phone_number: form.value.phone_number || null,
        satellite_church_id: form.value.satellite_church_id,
    })

    if (result.success) {
        message.value = { type: 'success', text: 'Profile updated successfully.' }
        editMode.value = false
    } else {
        message.value = { type: 'error', text: result.error ?? 'Failed to update.' }
    }
    saving.value = false
}

async function handlePhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    uploading.value = true
    message.value = null

    const result = await member.uploadPhoto(file)
    if (result.success) {
        message.value = { type: 'success', text: 'Photo updated.' }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Upload failed.' }
    }
    uploading.value = false
}

async function handleCoverPhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !auth.session?.user) return

    uploadingCover.value = true
    message.value = null

    const ext = file.name.split('.').pop()
    const path = `covers/${auth.session.user.id}.${ext}`

    const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })

    if (uploadErr) {
        message.value = { type: 'error', text: uploadErr.message }
        uploadingCover.value = false
        return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const result = await member.updateProfile({ cover_photo_url: urlData.publicUrl } as any)

    if (result.success) {
        message.value = { type: 'success', text: 'Cover photo updated.' }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Upload failed.' }
    }
    uploadingCover.value = false
}

const photoUrl = ref<string | null>(null)
watch(() => member.profile?.profile_photo_url, (url) => {
    photoUrl.value = url ?? null
}, { immediate: true })

const coverUrl = computed(() => (member.profile as any)?.cover_photo_url ?? null)

const initials = computed(() =>
    (member.profile?.first_name?.[0] ?? '') + (member.profile?.last_name?.[0] ?? '')
)

const fullName = computed(() =>
    [member.profile?.first_name, member.profile?.middle_name, member.profile?.last_name, member.profile?.ext_name]
        .filter(Boolean)
        .join(' ')
)

const churchName = computed(() => {
    if (!member.profile?.satellite_church_id) return null
    return churches.value.find(c => c.id === member.profile!.satellite_church_id)?.church_name ?? auth.profile?.satellite_church_name ?? null
})

// Stats
const totalAttendance = computed(() => attendance.logs.length)

const thisMonthAttendance = computed(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    return attendance.logs.filter(l => {
        if (!l.log_date) return false
        const d = new Date(l.log_date)
        return d.getFullYear() === y && d.getMonth() === m
    }).length
})

const enrolledPrograms = computed(() =>
    member.programs.filter((p: any) => p.is_active === 'Y' && !p.date_ended).length
)

const completedPrograms = computed(() =>
    member.programs.filter((p: any) => p.is_active === 'N' || p.date_ended).length
)

// Monthly attendance chart (last 6 months)
const chartData = computed(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return d
    })

    const labels = months.map(d => d.toLocaleDateString('en', { month: 'short' }))
    const counts = months.map(d => {
        const y = d.getFullYear()
        const m = d.getMonth()
        return attendance.logs.filter(l => {
            if (!l.log_date) return false
            const ld = new Date(l.log_date)
            return ld.getFullYear() === y && ld.getMonth() === m
        }).length
    })

    return {
        labels,
        datasets: [{
            label: 'Attendance',
            data: counts,
            borderColor: '#091f55',
            backgroundColor: 'rgba(9,31,85,0.08)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#091f55',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
        }],
    }
})

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#091f55', cornerRadius: 8, padding: 10, titleFont: { size: 13 }, bodyFont: { size: 12 } },
    },
    scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
        x: { grid: { display: false } },
    },
}

// Member since
const memberSince = computed(() => {
    const d = member.profile?.created_at
    if (!d) return null
    return new Date(d).toLocaleDateString('en', { month: 'long', year: 'numeric' })
})

// Birthday display
const birthdayDisplay = computed(() => {
    if (!member.profile?.birth_date) return null
    return new Date(member.profile.birth_date + 'T00:00:00').toLocaleDateString('en', { month: 'long', day: 'numeric' })
})

// Age based on birthday
const age = computed(() => {
    if (!member.profile?.birth_date) return null
    const bday = new Date(member.profile.birth_date + 'T00:00:00')
    const today = new Date()
    let a = today.getFullYear() - bday.getFullYear()
    const monthDiff = today.getMonth() - bday.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bday.getDate())) a--
    return a
})

// Phone number
const phoneNumber = computed(() => (member.profile as any)?.phone_number ?? null)

// Activity feed — merge attendance logs + program enrollments, sorted by date
interface ActivityItem {
    id: string
    type: 'attendance' | 'program_enrolled' | 'program_completed'
    title: string
    subtitle: string
    date: string
    icon: 'check' | 'academic' | 'star'
    color: 'navy' | 'emerald' | 'gold'
}

const activityFeed = computed<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    // Attendance logs (last 15)
    for (const log of attendance.logs.slice(0, 20)) {
        const logType = (log as any).log_type ?? 'event'
        items.push({
            id: `att-${log.id}`,
            type: 'attendance',
            title: logType === 'program' ? 'Program Attendance' : 'Event Check-in',
            subtitle: log.event_title ?? 'Untitled',
            date: log.logged_at ?? log.log_date ?? '',
            icon: 'check',
            color: 'navy',
        })
    }

    // Program enrollments
    for (const prog of member.programs) {
        const name = (prog as any).lib_programs?.type ?? prog.program_type ?? 'Untitled Program'
        items.push({
            id: `prog-enroll-${prog.id}`,
            type: 'program_enrolled',
            title: 'Enrolled in Program',
            subtitle: name,
            date: prog.date_started ?? '',
            icon: 'academic',
            color: 'emerald',
        })
        if (prog.date_ended) {
            items.push({
                id: `prog-done-${prog.id}`,
                type: 'program_completed',
                title: 'Completed Program',
                subtitle: name,
                date: prog.date_ended,
                icon: 'star',
                color: 'gold',
            })
        }
    }

    // Sort by date desc, take first 15
    return items
        .filter(i => i.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15)
})

function formatDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatActivityDate(d: string) {
    const date = new Date(d)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-48 bg-gray-200 rounded-xl animate-pulse" />
            <div class="flex items-end gap-4 -mt-12 px-6">
                <div class="w-28 h-28 rounded-full bg-gray-300 border-4 border-white animate-pulse" />
                <div class="flex-1 pb-2 space-y-2">
                    <div class="h-6 bg-gray-200 rounded w-48 animate-pulse" />
                    <div class="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                </div>
            </div>
        </div>

        <template v-else>
            <!-- Cover Photo -->
            <div class="relative h-48 sm:h-56 rounded-xl overflow-hidden bg-gradient-to-br from-navy via-navy-700 to-navy-600">
                <img v-if="coverUrl" :src="coverUrl" alt="Cover" class="w-full h-full object-cover" />
                <div v-else class="absolute inset-0 opacity-[0.06]" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;" />
                <label class="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/30 hover:bg-black/50 text-white text-xs font-medium rounded-lg backdrop-blur-sm cursor-pointer transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    </svg>
                    {{ uploadingCover ? 'Uploading...' : 'Edit Cover' }}
                    <input type="file" accept="image/*" class="hidden" :disabled="uploadingCover" @change="handleCoverPhoto" />
                </label>
            </div>

            <!-- Profile Header (avatar overlaps cover, name sits below) -->
            <div class="relative px-4 sm:px-6">
                <!-- Avatar row -->
                <div class="-mt-14 sm:-mt-16 flex items-end justify-between mb-4">
                    <div class="relative group/avatar shrink-0">
                        <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white bg-navy-100 flex items-center justify-center overflow-hidden shadow-lg">
                            <img v-if="photoUrl" :src="photoUrl" alt="Profile" class="w-full h-full object-cover" />
                            <span v-else class="text-2xl sm:text-3xl font-bold text-navy">{{ initials }}</span>
                        </div>
                        <label class="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 text-white opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-all">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                            </svg>
                            <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="handlePhoto" />
                        </label>
                    </div>
                    <!-- Edit button (aligned right, below cover) -->
                    <button
                        v-if="!editMode"
                        @click="editMode = true"
                        class="shrink-0 mb-1 inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                        Edit
                    </button>
                </div>

                <!-- Name + Info (own block, clearly below avatar) -->
                <div class="flex items-start justify-between gap-4 mb-4">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h1 class="text-xl sm:text-2xl font-heading font-bold text-gray-900">{{ fullName }}</h1>
                            <span
                                v-if="member.network.myRole"
                                class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                :class="{
                                    'bg-navy/10 text-navy': member.network.myRole === 'Pastor',
                                    'bg-blue-50 text-blue-700': member.network.myRole === 'Network Leader',
                                    'bg-emerald-50 text-emerald-700': member.network.myRole === 'L-Path Leader',
                                    'bg-gray-100 text-gray-600': member.network.myRole === 'Member',
                                }"
                            >
                                {{ member.network.myRole }}
                            </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                            <span v-if="churchName" class="text-sm text-gray-500">{{ churchName }}</span>
                            <span v-if="churchName && memberSince" class="text-gray-300">·</span>
                            <span v-if="memberSince" class="text-xs text-gray-400">Member since {{ memberSince }}</span>
                        </div>
                    </div>
                    <!-- Badges (right side) -->
                    <div class="flex flex-wrap items-center gap-1.5 shrink-0 pt-1">
                        <span v-if="devotionStreak > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-600">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                            </svg>
                            {{ devotionStreak }}d streak
                        </span>
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
            </div>

            <!-- Stat Cards (dashboard style) -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">Attended</p>
                        <p class="text-xl font-heading font-bold text-navy">{{ totalAttendance }}</p>
                    </div>
                    <div class="w-9 h-9 rounded-lg bg-navy/6 flex items-center justify-center shrink-0">
                        <svg class="w-4.5 h-4.5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">This Month</p>
                        <p class="text-xl font-heading font-bold text-navy">{{ thisMonthAttendance }}</p>
                    </div>
                    <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <svg class="w-4.5 h-4.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                    </div>
                </div>
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">Enrolled</p>
                        <p class="text-xl font-heading font-bold text-navy">{{ enrolledPrograms }}</p>
                    </div>
                    <div class="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                        <svg class="w-4.5 h-4.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                        </svg>
                    </div>
                </div>
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 transition-colors flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[10px] text-gray-500 uppercase tracking-wider leading-tight">Completed</p>
                        <p class="text-xl font-heading font-bold text-gold-600">{{ completedPrograms }}</p>
                    </div>
                    <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                        <svg class="w-4.5 h-4.5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                    </div>
                </div>
            </div>

            <!-- Badges -->
            <div v-if="memberBadges.length" class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <h2 class="font-heading font-semibold text-navy text-base mb-3">Badges</h2>
                <div class="flex flex-wrap gap-2">
                    <div
                        v-for="badge in memberBadges"
                        :key="badge.id"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                        :class="badgeStyle(badge.color)"
                        :title="`Recognized by ${badge.count} member${badge.count !== 1 ? 's' : ''}`"
                    >
                        <span>{{ badgeEmoji(badge.icon) }}</span>
                        <span>{{ badge.name }}</span>
                        <span class="opacity-60">{{ badge.count }}</span>
                    </div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="grid lg:grid-cols-3 gap-6">
                <!-- Left Column -->
                <div class="space-y-6">
                    <!-- About Card -->
                    <div v-if="!editMode" class="bg-white rounded-lg border border-gray-200 p-5">
                        <h2 class="font-heading font-semibold text-navy text-base mb-4">About</h2>
                        <div class="space-y-3.5">
                            <div class="flex items-start gap-3">
                                <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">Email</p>
                                    <p class="text-sm text-gray-700 break-all">{{ form.email || '—' }}</p>
                                </div>
                            </div>
                            <div v-if="birthdayDisplay" class="flex items-start gap-3">
                                <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.126-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265z" />
                                </svg>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">Birthday</p>
                                    <p class="text-sm text-gray-700">{{ birthdayDisplay }} <span v-if="age !== null" class="text-gray-400">({{ age }} yrs old)</span></p>
                                </div>
                            </div>
                            <div v-if="phoneNumber" class="flex items-start gap-3">
                                <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                </svg>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">Phone</p>
                                    <p class="text-sm text-gray-700">{{ phoneNumber }}</p>
                                </div>
                            </div>
                            <div v-if="churchName" class="flex items-start gap-3">
                                <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">Church</p>
                                    <p class="text-sm text-gray-700">{{ churchName }}</p>
                                </div>
                            </div>
                            <div v-if="member.network.myRole" class="flex items-start gap-3">
                                <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                </svg>
                                <div>
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-0.5">Role</p>
                                    <p class="text-sm text-gray-700">{{ member.network.myRole }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Edit Form Card -->
                    <div v-else class="bg-white rounded-lg border border-gray-200 p-5">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="font-heading font-semibold text-navy text-base">Edit Profile</h2>
                            <button @click="editMode = false; populateForm()" class="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                        <form @submit.prevent="handleSave" class="space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                                    <input v-model="form.first_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                                    <input v-model="form.last_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-500 mb-1">Middle Name</label>
                                    <input v-model="form.middle_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-500 mb-1">Ext (Jr, Sr, III)</label>
                                    <input v-model="form.ext_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Email</label>
                                <input :value="form.email" type="email" disabled class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Birth Date</label>
                                <input v-model="form.birth_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Phone Number</label>
                                <input v-model="form.phone_number" type="tel" placeholder="e.g. +63 912 345 6789" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-500 mb-1">Satellite Church</label>
                                <select v-model="form.satellite_church_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy">
                                    <option :value="null" disabled>Select a church</option>
                                    <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                                </select>
                            </div>
                            <button type="submit" :disabled="saving" class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors text-sm">
                                {{ saving ? 'Saving...' : 'Save Changes' }}
                            </button>
                        </form>
                    </div>

                    <!-- My Network Card -->
                    <div v-if="member.network.myRole" class="bg-white rounded-lg border border-gray-200 p-5">
                        <h2 class="font-heading font-semibold text-navy text-base mb-4">My Network</h2>
                        <div class="space-y-3">
                            <template v-if="member.network.myRole === 'Pastor'">
                                <p class="text-sm text-gray-500">You are a Pastor — no leadership hierarchy above you.</p>
                            </template>
                            <template v-else>
                                <div v-if="member.network.pastor" class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">{{ member.network.pastor.name }}</p>
                                        <p class="text-xs text-gray-400">Pastor</p>
                                    </div>
                                </div>
                                <div v-if="member.network.networkLeader" class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">{{ member.network.networkLeader.name }}</p>
                                        <p class="text-xs text-gray-400">Network Leader</p>
                                    </div>
                                </div>
                                <div v-if="member.network.lpathLeader" class="flex items-center gap-3">
                                    <div class="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                                        <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p class="text-sm font-medium text-gray-900">{{ member.network.lpathLeader.name }}</p>
                                        <p class="text-xs text-gray-400">L-Path Leader</p>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Monthly Attendance Chart -->
                    <div class="bg-white rounded-lg border border-gray-200 p-5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="font-heading font-semibold text-navy text-base">Monthly Attendance</h2>
                                <p class="text-xs text-gray-400 mt-0.5">Last 6 months</p>
                            </div>
                            <router-link :to="{ name: 'member-attendance' }" class="text-xs text-navy/60 hover:text-navy font-medium transition-colors">
                                View all
                            </router-link>
                        </div>
                        <div class="h-48">
                            <Line :data="chartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- Activity Feed -->
                    <div class="bg-white rounded-lg border border-gray-200 p-5">
                        <h2 class="font-heading font-semibold text-navy text-base mb-4">Recent Activity</h2>

                        <div v-if="!activityFeed.length" class="text-sm text-gray-400 py-6 text-center">
                            No recent activity yet.
                        </div>

                        <div v-else class="relative">
                            <!-- Timeline line -->
                            <div class="absolute left-4 top-2 bottom-2 w-px bg-gray-100" />

                            <div class="space-y-0">
                                <div
                                    v-for="item in activityFeed"
                                    :key="item.id"
                                    class="relative flex items-start gap-3 py-2.5"
                                >
                                    <!-- Timeline dot -->
                                    <div
                                        class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                        :class="{
                                            'bg-navy/10': item.color === 'navy',
                                            'bg-emerald-50': item.color === 'emerald',
                                            'bg-gold/10': item.color === 'gold',
                                        }"
                                    >
                                        <!-- Check icon (attendance) -->
                                        <svg v-if="item.icon === 'check'" class="w-3.5 h-3.5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <!-- Academic icon (enrolled) -->
                                        <svg v-else-if="item.icon === 'academic'" class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                                        </svg>
                                        <!-- Star icon (completed) -->
                                        <svg v-else class="w-3.5 h-3.5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                        </svg>
                                    </div>

                                    <!-- Content -->
                                    <div class="flex-1 min-w-0 pt-0.5">
                                        <p class="text-sm text-gray-900">
                                            <span class="font-medium">{{ item.title }}</span>
                                            <span class="text-gray-500"> — {{ item.subtitle }}</span>
                                        </p>
                                        <p class="text-xs text-gray-400 mt-0.5">{{ formatActivityDate(item.date) }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
