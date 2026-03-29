<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useMemberStore } from '@/stores/member.store'
import { useAnnouncementStore } from '@/stores/announcement.store'
import { useRsvp } from '@/composables/useRsvp'
import QrCodeModal from '@/components/common/QrCodeModal.vue'
import { supabase } from '@/lib/supabase'
import { useScripturePlanStore, type ScripturePlanEntry } from '@/stores/scripture-plan.store'
import { getBookByName } from '@/lib/bible-books'
import type { Tables } from '@/types/database.types'

const auth = useAuthStore()
const member = useMemberStore()
const announcementStore = useAnnouncementStore()
const { rsvps, rsvpCounts, fetchRsvps, setRsvp } = useRsvp()

const scripturePlanStore = useScripturePlanStore()
const showQr = ref(false)
const upcomingEvents = ref<Tables<'tbl_events'>[]>([])
const birthdays = ref<{ name: string; birthday: string; daysUntil: number }[]>([])
const todayReading = ref<ScripturePlanEntry | null>(null)
const scriptureVerses = ref<{ verse: number; text: string }[]>([])
const scriptureExpanded = ref(false)
const scriptureLoading = ref(false)
const pageLoading = ref(true)

// Feed data
interface FeedItem {
    id: string
    type: 'devotional' | 'prayer'
    user_id: string
    author_name: string
    content: string
    created_at: string
    is_public?: boolean
    status?: string
}

const feedItems = ref<FeedItem[]>([])
const devotionalReactions = ref<Map<string, { type: string; count: number; user_reacted: boolean }[]>>(new Map())
const prayerCounts = ref<Map<string, { count: number; user_prayed: boolean }>>(new Map())

const REACTION_TYPES = [
    { type: 'amen', label: 'Amen', emoji: '\u{1F64F}' },
    { type: 'like', label: 'Like', emoji: '\u{2764}\u{FE0F}' },
    { type: 'inspire', label: 'Inspired', emoji: '\u{2728}' },
]

onMounted(async () => {
    await Promise.all([
        member.fetchProfile(),
        member.fetchNetworkProfile(),
        fetchUpcomingEvents(),
        fetchUpcomingBirthdays(),
        announcementStore.fetchAnnouncements(),
        fetchCommunityFeed(),
        fetchTodayReading(),
    ])
    pageLoading.value = false
})

async function fetchCommunityFeed() {
    const [{ data: devotionals }, { data: prayers }] = await Promise.all([
        supabase
            .from('tbl_devotionals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20),
        supabase
            .from('tbl_prayer_requests')
            .select('*')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(20),
    ])

    const items: FeedItem[] = []

    for (const d of devotionals ?? []) {
        items.push({
            id: d.id,
            type: 'devotional',
            user_id: d.user_id,
            author_name: d.author_name ?? 'Member',
            content: d.content,
            created_at: d.created_at,
        })
    }

    for (const p of prayers ?? []) {
        items.push({
            id: p.id,
            type: 'prayer',
            user_id: p.user_id,
            author_name: p.author_name ?? 'Anonymous',
            content: p.content,
            created_at: p.created_at,
            is_public: p.is_public,
            status: p.status,
        })
    }

    // Sort by created_at desc
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    feedItems.value = items.slice(0, 30)

    // Fetch reactions for devotionals and prayer counts
    const devIds = items.filter(i => i.type === 'devotional').map(i => i.id)
    const prayerIds = items.filter(i => i.type === 'prayer').map(i => i.id)

    if (devIds.length) await fetchDevotionalReactions(devIds)
    if (prayerIds.length) await fetchPrayerCounts(prayerIds)
}

async function fetchDevotionalReactions(ids: string[]) {
    const { data } = await supabase
        .from('tbl_devotional_reactions')
        .select('devotional_id, type, user_id')
        .in('devotional_id', ids)

    const userId = auth.session?.user?.id
    const map = new Map<string, { type: string; count: number; user_reacted: boolean }[]>()

    for (const id of ids) {
        const devReactions = (data ?? []).filter(r => r.devotional_id === id)
        const counts = REACTION_TYPES.map(rt => {
            const matching = devReactions.filter(r => r.type === rt.type)
            return { type: rt.type, count: matching.length, user_reacted: matching.some(r => r.user_id === userId) }
        })
        map.set(id, counts)
    }
    devotionalReactions.value = map
}

async function fetchPrayerCounts(ids: string[]) {
    const { data } = await supabase
        .from('tbl_prayer_request_prayers')
        .select('prayer_request_id, user_id')
        .in('prayer_request_id', ids)

    const userId = auth.session?.user?.id
    const map = new Map<string, { count: number; user_prayed: boolean }>()

    for (const id of ids) {
        const prayers = (data ?? []).filter(p => p.prayer_request_id === id)
        map.set(id, { count: prayers.length, user_prayed: prayers.some(p => p.user_id === userId) })
    }
    prayerCounts.value = map
}

function getReaction(devId: string, type: string) {
    return devotionalReactions.value.get(devId)?.find(r => r.type === type) ?? { type, count: 0, user_reacted: false }
}

function getPrayerCount(id: string) {
    return prayerCounts.value.get(id) ?? { count: 0, user_prayed: false }
}

async function toggleReaction(devId: string, type: string) {
    if (!auth.session?.user) return
    const existing = getReaction(devId, type)
    if (existing.user_reacted) {
        await supabase.from('tbl_devotional_reactions').delete()
            .eq('devotional_id', devId).eq('user_id', auth.session.user.id).eq('type', type)
    } else {
        await supabase.from('tbl_devotional_reactions').insert({ devotional_id: devId, user_id: auth.session.user.id, type })
    }
    const devIds = feedItems.value.filter(i => i.type === 'devotional').map(i => i.id)
    await fetchDevotionalReactions(devIds)
}

async function togglePray(id: string) {
    if (!auth.session?.user) return
    const existing = getPrayerCount(id)
    if (existing.user_prayed) {
        await supabase.from('tbl_prayer_request_prayers').delete()
            .eq('prayer_request_id', id).eq('user_id', auth.session.user.id)
    } else {
        await supabase.from('tbl_prayer_request_prayers').insert({ prayer_request_id: id, user_id: auth.session.user.id })
    }
    const prayerIds = feedItems.value.filter(i => i.type === 'prayer').map(i => i.id)
    await fetchPrayerCounts(prayerIds)
}

async function fetchTodayReading() {
    todayReading.value = await scripturePlanStore.fetchTodayReading()
}

async function loadScriptureText() {
    if (!todayReading.value || scriptureVerses.value.length) {
        scriptureExpanded.value = !scriptureExpanded.value
        return
    }
    scriptureLoading.value = true
    scriptureExpanded.value = true

    const book = getBookByName(todayReading.value.book_name)
    if (!book) { scriptureLoading.value = false; return }

    try {
        // Fetch all chapters in the range
        const allVerses: { verse: number; text: string }[] = []
        for (let ch = todayReading.value.chapter_start; ch <= todayReading.value.chapter_end; ch++) {
            const res = await fetch(`https://bolls.life/get-chapter/KJV/${book.code}/${ch}/`)
            if (res.ok) {
                const data = await res.json()
                const chapterLabel = todayReading.value.chapter_start !== todayReading.value.chapter_end
                    ? `[Ch. ${ch}] ` : ''
                for (const v of data) {
                    allVerses.push({ verse: v.verse, text: `${chapterLabel}${v.verse}. ${v.text}` })
                }
            }
        }
        scriptureVerses.value = allVerses
    } catch {
        scriptureVerses.value = [{ verse: 0, text: 'Could not load scripture text. Please try again later.' }]
    }
    scriptureLoading.value = false
}

function todayReadingRef(): string {
    if (!todayReading.value) return ''
    const r = todayReading.value
    if (r.chapter_start === r.chapter_end) return `${r.book_name} ${r.chapter_start}`
    return `${r.book_name} ${r.chapter_start}-${r.chapter_end}`
}

async function fetchUpcomingEvents() {
    const now = new Date().toISOString()
    const { data } = await supabase
        .from('tbl_events')
        .select('*')
        .gte('duration_to', now)
        .eq('is_active', true)
        .order('duration_from', { ascending: true })
        .limit(5)
    upcomingEvents.value = data ?? []
    if (data?.length) {
        await fetchRsvps(data.map((e) => e.id))
    }
}

async function fetchUpcomingBirthdays() {
    const churchId = auth.profile?.satellite_church_id
    let query = supabase
        .from('tbl_members_profile')
        .select('first_name, last_name, date_of_birth')
        .not('date_of_birth', 'is', null)
        .eq('status', 'approved')

    if (churchId) query = query.eq('satellite_church_id', churchId)

    const { data } = await query

    if (!data) return

    const today = new Date()
    const results: { name: string; birthday: string; daysUntil: number }[] = []

    for (const m of data) {
        if (!m.date_of_birth) continue
        const bday = new Date(m.date_of_birth)
        const nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate())
        if (nextBday < today) nextBday.setFullYear(today.getFullYear() + 1)
        const diff = Math.ceil((nextBday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 30) {
            results.push({
                name: [m.first_name, m.last_name].filter(Boolean).join(' '),
                birthday: bday.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
                daysUntil: diff,
            })
        }
    }

    results.sort((a, b) => a.daysUntil - b.daysUntil)
    birthdays.value = results.slice(0, 10)
}

// Greeting based on time of day
const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
})

const recentAnnouncements = computed(() =>
    [...announcementStore.announcements]
        .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1
            if (!a.is_pinned && b.is_pinned) return 1
            return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        })
        .slice(0, 5),
)

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEventTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function timeAgo(d: string) {
    const now = Date.now()
    const then = new Date(d).getTime()
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function getRsvpStatus(eventId: number) {
    return rsvps.value.get(eventId)?.status ?? null
}

function getRsvpCount(eventId: number) {
    return rsvpCounts.value.get(eventId) ?? { going: 0, maybe: 0 }
}
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <!-- Welcome Banner -->
        <div class="relative overflow-hidden rounded-lg mb-8">
            <div class="absolute inset-0 bg-gradient-to-br from-navy via-navy-700 to-navy-600" />
            <div class="absolute inset-0 opacity-[0.04]" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;" />
            <div class="relative px-5 py-6 sm:px-8 sm:py-10 flex items-center justify-between gap-4">
                <div>
                    <p class="text-navy-200 text-[11px] sm:text-sm font-medium mb-0.5 sm:mb-1">
                        {{ new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }) }}
                    </p>
                    <h1 class="text-lg sm:text-3xl font-heading font-bold text-white mb-1 sm:mb-2">
                        {{ greeting }}, {{ auth.user?.first_name }}
                    </h1>
                    <p class="text-white/60 text-xs sm:text-sm">
                        {{ auth.profile?.satellite_church_name ?? 'RCMI' }} Community Hub
                    </p>
                </div>
                <!-- QR Quick Access -->
                <button
                    @click="showQr = true"
                    class="shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all duration-200 group cursor-pointer"
                >
                    <svg class="w-8 h-8 text-white/80 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                    </svg>
                    <span class="text-[11px] font-medium text-white/70 group-hover:text-white/90 transition-colors">My QR</span>
                </button>
            </div>
        </div>

        <QrCodeModal :open="showQr" @close="showQr = false" />

        <!-- Loading skeleton -->
        <template v-if="pageLoading">
            <div class="space-y-4 mb-6">
                <div v-for="i in 3" :key="i" class="bg-white rounded-lg p-5 border border-gray-200 animate-pulse">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-full bg-gray-200" />
                        <div class="space-y-1.5">
                            <div class="h-3 bg-gray-200 rounded w-28" />
                            <div class="h-2.5 bg-gray-200 rounded w-16" />
                        </div>
                    </div>
                    <div class="h-4 bg-gray-200 rounded w-full mb-2" />
                    <div class="h-4 bg-gray-200 rounded w-3/4" />
                </div>
            </div>
        </template>

        <template v-else>
            <!-- Main grid -->
            <div class="grid lg:grid-cols-3 gap-6">
                <!-- Left column: Community Feed -->
                <div class="lg:col-span-2 space-y-4">
                    <div class="flex items-center justify-between mb-2">
                        <h2 class="font-heading font-semibold text-navy text-lg">Community Feed</h2>
                        <div class="flex items-center gap-2">
                            <router-link :to="{ name: 'member-devotional' }" class="text-xs text-navy/60 hover:text-navy font-medium transition-colors">Devotional Wall</router-link>
                            <span class="text-gray-300">|</span>
                            <router-link :to="{ name: 'member-prayer-requests' }" class="text-xs text-navy/60 hover:text-navy font-medium transition-colors">Prayer Requests</router-link>
                        </div>
                    </div>

                    <!-- Empty feed -->
                    <div v-if="!feedItems.length" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <svg class="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        <p class="text-gray-400 text-sm">No community posts yet. Be the first to share!</p>
                        <router-link :to="{ name: 'member-devotional' }" class="inline-block mt-3 text-sm text-navy font-semibold hover:underline">Post a Devotional</router-link>
                    </div>

                    <!-- Feed Items -->
                    <div
                        v-for="item in feedItems"
                        :key="item.type + '-' + item.id"
                        class="bg-white rounded-xl border border-gray-200 p-4"
                    >
                        <!-- Header -->
                        <div class="flex items-center gap-3 mb-2.5">
                            <div
                                class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                :class="item.type === 'devotional' ? 'bg-violet-50 text-violet-600' : 'bg-amber-50 text-amber-600'"
                            >
                                {{ item.author_name?.[0] ?? '?' }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="text-sm font-medium text-gray-900 truncate">{{ item.author_name }}</p>
                                    <span
                                        class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                        :class="item.type === 'devotional' ? 'bg-violet-50 text-violet-500' : 'bg-amber-50 text-amber-500'"
                                    >
                                        {{ item.type === 'devotional' ? 'Devotional' : 'Prayer Request' }}
                                    </span>
                                </div>
                                <p class="text-xs text-gray-400">{{ timeAgo(item.created_at) }}</p>
                            </div>
                        </div>

                        <!-- Content -->
                        <p class="text-sm text-gray-700 whitespace-pre-line mb-3">{{ item.content }}</p>

                        <!-- Devotional Reactions -->
                        <div v-if="item.type === 'devotional'" class="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <button
                                v-for="rt in REACTION_TYPES"
                                :key="rt.type"
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                                :class="getReaction(item.id, rt.type).user_reacted
                                    ? 'bg-navy/10 text-navy'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                @click="toggleReaction(item.id, rt.type)"
                            >
                                <span>{{ rt.emoji }}</span>
                                <span v-if="getReaction(item.id, rt.type).count > 0">{{ getReaction(item.id, rt.type).count }}</span>
                                <span v-else>{{ rt.label }}</span>
                            </button>
                        </div>

                        <!-- Prayer Request Actions -->
                        <div v-else class="pt-2 border-t border-gray-100">
                            <button
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                                :class="getPrayerCount(item.id).user_prayed
                                    ? 'bg-navy/10 text-navy'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                @click="togglePray(item.id)"
                            >
                                <span>&#x1F64F;</span>
                                <span v-if="getPrayerCount(item.id).count > 0">
                                    {{ getPrayerCount(item.id).count }} praying
                                </span>
                                <span v-else>Pray for this</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Right column -->
                <div class="space-y-6">
                    <!-- Today's Scripture Reading -->
                    <div v-if="todayReading" class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200/60 p-5 sm:p-6">
                        <div class="flex items-center gap-2 mb-3">
                            <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            <h2 class="font-heading font-semibold text-amber-900 text-lg">Today's Reading</h2>
                        </div>
                        <p class="text-xl font-bold text-amber-800 mb-1">{{ todayReadingRef() }}</p>
                        <p v-if="todayReading.notes" class="text-sm text-amber-700/80 mb-3 italic">{{ todayReading.notes }}</p>

                        <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            :class="scriptureExpanded ? 'bg-amber-200/60 text-amber-800' : 'bg-white/70 text-amber-700 hover:bg-white'"
                            @click="loadScriptureText"
                        >
                            <svg v-if="scriptureLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span v-else>{{ scriptureExpanded ? 'Hide' : 'Read' }} Scripture</span>
                        </button>

                        <div v-if="scriptureExpanded && scriptureVerses.length" class="mt-3 bg-white/60 rounded-lg p-4 max-h-80 overflow-y-auto">
                            <p
                                v-for="v in scriptureVerses"
                                :key="v.verse"
                                class="text-sm text-gray-700 leading-relaxed mb-1"
                            >{{ v.text }}</p>
                        </div>
                    </div>

                    <!-- Upcoming Events with RSVP -->
                    <div class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="font-heading font-semibold text-navy text-lg">Upcoming Events</h2>
                            <router-link
                                :to="{ name: 'member-events' }"
                                class="text-xs text-navy/60 hover:text-navy font-medium transition-colors"
                            >
                                View all
                            </router-link>
                        </div>
                        <div v-if="!upcomingEvents.length" class="text-sm text-gray-400 py-6 text-center">
                            <svg class="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            No upcoming events
                        </div>
                        <div v-else class="space-y-3">
                            <router-link
                                v-for="evt in upcomingEvents"
                                :key="evt.id"
                                :to="{ name: 'member-event-detail', params: { id: evt.id } }"
                                class="block group/event rounded-lg bg-gray-50/80 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-200 p-3"
                            >
                                <div class="flex items-start gap-3">
                                    <div class="w-11 h-11 rounded-lg bg-navy/[0.08] flex flex-col items-center justify-center text-navy shrink-0">
                                        <span class="text-[9px] uppercase font-semibold leading-none text-navy/60">
                                            {{ new Date(evt.duration_from!).toLocaleDateString('en', { month: 'short' }) }}
                                        </span>
                                        <span class="text-base font-heading font-bold leading-tight">
                                            {{ new Date(evt.duration_from!).getDate() }}
                                        </span>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-sm font-semibold text-gray-900 truncate">{{ evt.event_title }}</p>
                                        <p class="text-xs text-gray-500 mt-0.5">
                                            {{ formatEventTime(evt.duration_from) }}
                                            <span v-if="evt.event_type" class="text-gray-300 mx-1">&middot;</span>
                                            <span v-if="evt.event_type" class="text-gray-400">{{ evt.event_type }}</span>
                                        </p>
                                    </div>
                                </div>
                                <!-- RSVP buttons -->
                                <div class="flex items-center gap-2 mt-2.5 ml-14" @click.prevent>
                                    <button
                                        class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'going' ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-200'"
                                        @click="setRsvp(evt.id, 'going')"
                                    >
                                        Going {{ getRsvpCount(evt.id).going > 0 ? `(${getRsvpCount(evt.id).going})` : '' }}
                                    </button>
                                    <button
                                        class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'maybe' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-600 border border-gray-200 hover:border-amber-200'"
                                        @click="setRsvp(evt.id, 'maybe')"
                                    >
                                        Maybe {{ getRsvpCount(evt.id).maybe > 0 ? `(${getRsvpCount(evt.id).maybe})` : '' }}
                                    </button>
                                    <button
                                        class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                        :class="getRsvpStatus(evt.id) === 'not_going' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200'"
                                        @click="setRsvp(evt.id, 'not_going')"
                                    >
                                        Can't Go
                                    </button>
                                </div>
                            </router-link>
                        </div>
                    </div>

                    <!-- Announcements -->
                    <div class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="font-heading font-semibold text-navy text-lg">Announcements</h2>
                            <router-link
                                :to="{ name: 'member-announcements' }"
                                class="text-xs text-navy/60 hover:text-navy font-medium transition-colors"
                            >
                                View all
                            </router-link>
                        </div>
                        <div v-if="!recentAnnouncements.length" class="text-sm text-gray-400 py-6 text-center">
                            No announcements yet
                        </div>
                        <div v-else class="space-y-3">
                            <router-link
                                v-for="a in recentAnnouncements"
                                :key="a.id"
                                :to="{ name: 'member-announcements' }"
                                class="block p-3 rounded-lg transition-all duration-200 hover:bg-gray-50"
                                :class="a.is_pinned ? 'bg-gold-50/50 border border-gold-200/40' : 'bg-gray-50/60 border border-transparent hover:border-gray-100'"
                            >
                                <div class="flex items-start gap-3">
                                    <div
                                        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                        :class="a.is_pinned ? 'bg-gold/15' : 'bg-navy/[0.06]'"
                                    >
                                        <svg v-if="a.is_pinned" class="w-3 h-3 text-gold-600" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10.75 2.567a.75.75 0 00-1.5 0v2.017a.75.75 0 001.5 0V2.567zM10 6a4 4 0 00-4 4c0 1.17.503 2.222 1.304 2.95l-.052 2.3A.75.75 0 008 16h4a.75.75 0 00.748-.75l-.052-2.3A3.982 3.982 0 0014 10a4 4 0 00-4-4zm-1.25 11.5a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z" />
                                        </svg>
                                        <svg v-else class="w-3 h-3 text-navy/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
                                        </svg>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <p class="text-sm font-semibold text-gray-900 truncate">{{ a.title }}</p>
                                            <span v-if="a.is_pinned" class="text-[10px] text-gold-600 font-semibold uppercase tracking-wider shrink-0">Pinned</span>
                                        </div>
                                        <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ a.content }}</p>
                                        <p class="text-[11px] text-gray-300 mt-1">{{ formatDate(a.created_at ?? null) }}</p>
                                    </div>
                                </div>
                            </router-link>
                        </div>
                    </div>

                    <!-- Birthday Reminders -->
                    <div v-if="birthdays.length" class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                        <h2 class="font-heading font-semibold text-navy text-lg mb-4">Birthdays</h2>
                        <div class="space-y-3">
                            <div
                                v-for="b in birthdays"
                                :key="b.name"
                                class="flex items-center gap-3"
                            >
                                <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-navy/40 shrink-0 border border-gray-100">
                                    {{ b.name.split(' ').map(n => n[0]).join('') }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-800 truncate">{{ b.name }}</p>
                                    <p class="text-xs text-gray-400">{{ b.birthday }}</p>
                                </div>
                                <span
                                    class="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                                    :class="b.daysUntil === 0 ? 'bg-gold/15 text-gold-700' : 'bg-gray-50 text-gray-500 border border-gray-100'"
                                >
                                    {{ b.daysUntil === 0 ? 'Today!' : `${b.daysUntil}d` }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Network Profile -->
                    <div class="bg-white rounded-lg border border-gray-200 p-5 sm:p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="font-heading font-semibold text-navy text-lg">My Network</h2>
                                <p v-if="member.network.myRole" class="text-xs text-gray-500 mt-0.5">
                                    My Role: <span class="font-semibold text-navy">{{ member.network.myRole }}</span>
                                </p>
                            </div>
                        </div>
                        <p v-if="member.network.myRole === 'Pastor'" class="text-sm text-gray-500">
                            You are a Pastor — no leadership hierarchy above you.
                        </p>
                        <div v-else class="space-y-3">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                                    <svg class="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Pastor</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">{{ member.network.pastor?.name ?? 'Not assigned' }}</p>
                                </div>
                            </div>
                            <div v-if="member.network.myRole !== 'Network Leader'" class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                    <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Network Leader</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">{{ member.network.networkLeader?.name ?? 'Not assigned' }}</p>
                                </div>
                            </div>
                            <div v-if="member.network.myRole === 'Member'" class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                    <svg class="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">L-Path Leader</p>
                                    <p class="text-sm font-medium text-gray-800 truncate">{{ member.network.lpathLeader?.name ?? 'Not assigned' }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Church Info -->
                    <div class="bg-gradient-to-br from-navy to-navy-700 rounded-lg p-5 sm:p-6 text-white">
                        <div class="flex items-center gap-3 mb-3">
                            <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                <svg class="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                                </svg>
                            </div>
                            <h2 class="font-heading font-semibold text-base">My Church</h2>
                        </div>
                        <p class="text-base font-semibold text-white">
                            {{ auth.profile?.satellite_church_name ?? 'Not assigned' }}
                        </p>
                        <p class="text-sm text-white/50 mt-1">Member since {{ formatDate(auth.profile?.created_at ?? null) }}</p>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
