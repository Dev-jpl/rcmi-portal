<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

const props = defineProps<{ userId: string }>()
const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const profile = ref<any>(null)
const badges = ref<{ id: number; name: string; icon: string; color: string; count: number }[]>([])
const allBadges = ref<{ id: number; name: string; icon: string; color: string }[]>([])
const myGivenBadges = ref<Set<number>>(new Set())
const givingBadgeId = ref<number | null>(null)
const showBadgeModal = ref(false)
const totalAttendance = ref(0)
const thisMonthAttendance = ref(0)
const enrolledPrograms = ref(0)
const completedPrograms = ref(0)
const devotionStreak = ref(0)

const isOwnProfile = computed(() => auth.session?.user?.id === props.userId)

// Testimonials
interface Testimonial {
    id: string
    profile_user_id: string
    author_id: string
    author_name: string
    content: string
    approval_status: string
    created_at: string
}

const testimonials = ref<Testimonial[]>([])
const newTestimonial = ref('')
const postingTestimonial = ref(false)
const testimonialMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

onMounted(async () => {
    // Redirect to own profile page if viewing self
    if (isOwnProfile.value) {
        router.replace({ name: 'member-profile' })
        return
    }

    await Promise.all([
        fetchProfile(),
        fetchBadges(),
        fetchAllBadges(),
        fetchStats(),
        fetchDevotionStreak(),
        fetchTestimonials(),
    ])
    loading.value = false
})

async function fetchProfile() {
    const { data } = await supabase
        .from('tbl_members_profile')
        .select('*')
        .eq('user_id', props.userId)
        .maybeSingle()
    profile.value = data
}

async function fetchBadges() {
    const { data } = await supabase
        .from('tbl_member_badges')
        .select('badge_id, given_by, lib_badges(id, name, icon, color)')
        .eq('member_id', props.userId)

    if (!data?.length) return

    const counts = new Map<number, { badge: any; count: number }>()
    const myId = auth.session?.user?.id

    for (const row of data) {
        const badge = (row as any).lib_badges
        if (!badge) continue

        if (row.given_by === myId) myGivenBadges.value.add(badge.id)

        const existing = counts.get(badge.id)
        if (existing) {
            existing.count++
        } else {
            counts.set(badge.id, { badge, count: 1 })
        }
    }

    badges.value = Array.from(counts.values())
        .map(({ badge, count }) => ({ id: badge.id, name: badge.name, icon: badge.icon, color: badge.color, count }))
        .sort((a, b) => b.count - a.count)
}

async function fetchAllBadges() {
    const { data } = await supabase
        .from('lib_badges')
        .select('id, name, icon, color')
        .eq('is_active', true)
        .order('name')
    allBadges.value = data ?? []
}

async function fetchStats() {
    // Attendance
    const { count: totalCount } = await supabase
        .from('tbl_attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', props.userId)
    totalAttendance.value = totalCount ?? 0

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const { count: monthCount } = await supabase
        .from('tbl_attendance_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', props.userId)
        .gte('log_date', monthStart)
    thisMonthAttendance.value = monthCount ?? 0

    // Programs
    const { data: progs } = await supabase
        .from('tbl_program_involvements')
        .select('is_active, date_ended')
        .eq('user_id', props.userId)

    if (progs) {
        enrolledPrograms.value = progs.filter(p => p.is_active === 'Y' && !p.date_ended).length
        completedPrograms.value = progs.filter(p => p.is_active === 'N' || p.date_ended).length
    }
}

async function fetchDevotionStreak() {
    const { data } = await supabase
        .from('tbl_devotionals')
        .select('created_at')
        .eq('user_id', props.userId)
        .order('created_at', { ascending: false })
        .limit(365)

    if (!data?.length) return

    const dates = [...new Set(data.map(d => d.created_at.split('T')[0]))].sort().reverse()
    const today = new Date().toISOString().split('T')[0]
    let streak = 0
    let checkDate = today

    for (const date of dates) {
        if (date === checkDate) {
            streak++
            const prev = new Date(checkDate + 'T00:00:00')
            prev.setDate(prev.getDate() - 1)
            checkDate = prev.toISOString().split('T')[0]
        } else if (streak === 0) {
            const yesterday = new Date(today + 'T00:00:00')
            yesterday.setDate(yesterday.getDate() - 1)
            if (date === yesterday.toISOString().split('T')[0]) {
                streak = 1
                const prev = new Date(date + 'T00:00:00')
                prev.setDate(prev.getDate() - 1)
                checkDate = prev.toISOString().split('T')[0]
            } else {
                break
            }
        } else {
            break
        }
    }

    devotionStreak.value = streak
}

async function giveBadge(badgeId: number) {
    if (!auth.session?.user || myGivenBadges.value.has(badgeId)) return
    givingBadgeId.value = badgeId

    const { error } = await supabase.from('tbl_member_badges').insert({
        member_id: props.userId,
        badge_id: badgeId,
        given_by: auth.session.user.id,
    })

    if (!error) {
        myGivenBadges.value.add(badgeId)
        await fetchBadges()
    }

    givingBadgeId.value = null
    showBadgeModal.value = false
}

// ── Testimonials ──
async function fetchTestimonials() {
    const { data } = await supabase
        .from('tbl_testimonials')
        .select('*')
        .eq('profile_user_id', props.userId)
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false })

    testimonials.value = data ?? []
}

const hasPostedTestimonial = computed(() => {
    const myId = auth.session?.user?.id
    if (!myId) return false
    return testimonials.value.some(t => t.author_id === myId)
})

async function postTestimonial() {
    if (!newTestimonial.value.trim() || !auth.session?.user) return
    postingTestimonial.value = true
    testimonialMessage.value = null

    const authorName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Member'

    const { error } = await supabase.from('tbl_testimonials').insert({
        profile_user_id: props.userId,
        author_id: auth.session.user.id,
        author_name: authorName,
        content: newTestimonial.value.trim(),
        approval_status: 'pending',
    })

    if (error) {
        testimonialMessage.value = { type: 'error', text: error.message }
    } else {
        testimonialMessage.value = { type: 'success', text: 'Testimonial submitted! It will appear after the profile owner approves it.' }
        newTestimonial.value = ''
    }
    postingTestimonial.value = false
}

function testimonialTimeAgo(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

const fullName = computed(() =>
    [profile.value?.first_name, profile.value?.middle_name, profile.value?.last_name, profile.value?.ext_name]
        .filter(Boolean)
        .join(' ')
)

const initials = computed(() =>
    (profile.value?.first_name?.[0] ?? '') + (profile.value?.last_name?.[0] ?? '')
)

const coverUrl = computed(() => profile.value?.cover_photo_url ?? null)

const memberSince = computed(() => {
    if (!profile.value?.created_at) return null
    return new Date(profile.value.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' })
})

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
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-48 bg-gray-200 rounded-xl animate-pulse" />
            <div class="flex items-end gap-4 -mt-12 px-6">
                <div class="w-24 h-24 rounded-full bg-gray-300 border-4 border-white animate-pulse" />
                <div class="flex-1 pb-2 space-y-2">
                    <div class="h-6 bg-gray-200 rounded w-48 animate-pulse" />
                    <div class="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                </div>
            </div>
        </div>

        <!-- Not found -->
        <div v-else-if="!profile" class="text-center py-16">
            <p class="text-gray-400 mb-4">Member not found.</p>
            <router-link :to="{ name: 'member-directory' }" class="text-sm text-navy font-medium hover:underline">Back to Directory</router-link>
        </div>

        <template v-else>
            <!-- Back link -->
            <router-link :to="{ name: 'member-directory' }" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy mb-4 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Directory
            </router-link>

            <!-- Cover Photo -->
            <div class="relative h-48 sm:h-56 rounded-xl overflow-hidden bg-gradient-to-br from-navy via-navy-700 to-navy-600">
                <img v-if="coverUrl" :src="coverUrl" alt="Cover" class="w-full h-full object-cover" />
                <div v-else class="absolute inset-0 opacity-[0.06]" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;" />
            </div>

            <!-- Profile Header -->
            <div class="relative px-4 sm:px-6">
                <div class="-mt-14 sm:-mt-16 flex items-end justify-between mb-4">
                    <!-- Avatar -->
                    <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white bg-navy-100 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                        <img v-if="profile.profile_photo_url" :src="profile.profile_photo_url" alt="Profile" class="w-full h-full object-cover" />
                        <span v-else class="text-2xl sm:text-3xl font-bold text-navy">{{ initials }}</span>
                    </div>
                    <!-- Give Badge button -->
                    <button
                        @click="showBadgeModal = true"
                        class="shrink-0 mb-1 inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-700 transition-colors"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                        </svg>
                        Give Badge
                    </button>
                </div>

                <!-- Name + Info -->
                <div class="flex items-start justify-between gap-4 mb-4">
                    <div class="min-w-0">
                        <h1 class="text-xl sm:text-2xl font-heading font-bold text-gray-900">{{ fullName }}</h1>
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                            <span v-if="profile.satellite_church_name" class="text-sm text-gray-500">{{ profile.satellite_church_name }}</span>
                            <span v-if="profile.satellite_church_name && memberSince" class="text-gray-300">·</span>
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
            </div>

            <!-- Stat Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 flex items-center justify-between gap-2">
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
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 flex items-center justify-between gap-2">
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
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 flex items-center justify-between gap-2">
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
                <div class="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 flex items-center justify-between gap-2">
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
            <div class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <div class="flex items-center justify-between mb-3">
                    <h2 class="font-heading font-semibold text-navy text-base">Badges</h2>
                    <button
                        @click="showBadgeModal = true"
                        class="text-xs text-navy/60 hover:text-navy font-medium transition-colors"
                    >
                        + Give Badge
                    </button>
                </div>
                <div v-if="!badges.length" class="text-sm text-gray-400 py-4 text-center">
                    No badges yet. Be the first to recognize this member!
                </div>
                <div v-else class="flex flex-wrap gap-2">
                    <div
                        v-for="badge in badges"
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
            <!-- Testimonials Section -->
            <div class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                <h2 class="font-heading font-semibold text-navy text-base mb-4">Testimonials</h2>

                <!-- Post testimonial form -->
                <div v-if="!hasPostedTestimonial" class="mb-4">
                    <textarea
                        v-model="newTestimonial"
                        placeholder="Write a testimonial for this member..."
                        rows="3"
                        class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                    />
                    <div class="flex items-center justify-between mt-2">
                        <p class="text-[11px] text-gray-400">Requires approval from the profile owner.</p>
                        <button
                            :disabled="!newTestimonial.trim() || postingTestimonial"
                            class="px-4 py-2 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors"
                            @click="postTestimonial"
                        >
                            {{ postingTestimonial ? 'Submitting...' : 'Submit Testimonial' }}
                        </button>
                    </div>
                    <p
                        v-if="testimonialMessage"
                        class="text-xs mt-2 rounded-lg px-3 py-2"
                        :class="testimonialMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
                    >
                        {{ testimonialMessage.text }}
                    </p>
                </div>
                <div v-else class="mb-4 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                    You've already submitted a testimonial for this member.
                </div>

                <!-- Approved testimonials list -->
                <div v-if="!testimonials.length" class="text-sm text-gray-400 py-4 text-center">
                    No testimonials yet. Be the first to write one!
                </div>

                <div v-else class="space-y-3">
                    <div
                        v-for="t in testimonials"
                        :key="t.id"
                        class="bg-gray-50 rounded-lg px-4 py-3"
                    >
                        <div class="flex items-center gap-2 mb-1.5">
                            <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy">
                                {{ t.author_name?.[0] ?? '?' }}
                            </div>
                            <p class="text-xs font-medium text-gray-900">{{ t.author_name }}</p>
                            <span class="text-[10px] text-gray-400">{{ testimonialTimeAgo(t.created_at) }}</span>
                        </div>
                        <p class="text-sm text-gray-700 whitespace-pre-line">{{ t.content }}</p>
                    </div>
                </div>
            </div>
        </template>

        <!-- Give Badge Modal -->
        <Teleport to="body">
            <div v-if="showBadgeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/40" @click="showBadgeModal = false" />
                <div class="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-heading font-semibold text-navy text-lg">Give a Badge</h3>
                        <button @click="showBadgeModal = false" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p class="text-sm text-gray-500 mb-4">
                        Recognize <span class="font-medium text-gray-900">{{ profile?.first_name }}</span> with a badge. You can give each badge once.
                    </p>
                    <div class="space-y-2">
                        <button
                            v-for="b in allBadges"
                            :key="b.id"
                            :disabled="myGivenBadges.has(b.id) || givingBadgeId === b.id"
                            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all"
                            :class="myGivenBadges.has(b.id)
                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 hover:border-navy/20 hover:bg-navy/2 cursor-pointer'"
                            @click="giveBadge(b.id)"
                        >
                            <span class="text-lg">{{ badgeEmoji(b.icon) }}</span>
                            <div class="flex-1">
                                <p class="text-sm font-medium text-gray-900">{{ b.name }}</p>
                                <p v-if="myGivenBadges.has(b.id)" class="text-[11px] text-gray-400">Already given</p>
                            </div>
                            <svg v-if="myGivenBadges.has(b.id)" class="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span v-else-if="givingBadgeId === b.id" class="text-xs text-gray-400">Giving...</span>
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
