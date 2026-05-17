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
const scripturePlanStore = useScripturePlanStore()
const { rsvps, rsvpCounts, fetchRsvps, setRsvp } = useRsvp()

const showQr = ref(false)
const upcomingEvents = ref<Tables<'tbl_events'>[]>([])
const birthdays = ref<{ name: string; birthday: string; daysUntil: number }[]>([])
const todayReading = ref<ScripturePlanEntry | null>(null)
const scriptureVerses = ref<{ verse: number; text: string }[]>([])
const scriptureLoading = ref(false)
const pageLoading = ref(true)

// Announcements carousel
const carouselIndex = ref(0)

onMounted(async () => {
    await Promise.all([
        member.fetchProfile(),
        member.fetchNetworkProfile(),
        fetchUpcomingEvents(),
        fetchUpcomingBirthdays(),
        announcementStore.fetchAnnouncements(),
        fetchTodayReading(),
    ])
    pageLoading.value = false
})

/** Strip Strong's Concordance tags like <S>1234</S> from KJV text */
function stripStrongs(text: string): string {
    return text.replace(/<S>\d+<\/S>/g, '').replace(/\s{2,}/g, ' ').trim()
}

// ── Scripture ──
async function fetchTodayReading() {
    todayReading.value = await scripturePlanStore.fetchTodayReading()
    if (todayReading.value) await loadScripturePreview()
}

async function loadScripturePreview() {
    if (!todayReading.value) return
    scriptureLoading.value = true

    const book = getBookByName(todayReading.value.book_name)
    if (!book) { scriptureLoading.value = false; return }

    try {
        const allVerses: { verse: number; text: string }[] = []
        for (let ch = todayReading.value.chapter_start; ch <= todayReading.value.chapter_end; ch++) {
            const res = await fetch(`https://bolls.life/get-chapter/KJV/${book.code}/${ch}/`)
            if (res.ok) {
                const data = await res.json()
                for (const v of data) {
                    allVerses.push({ verse: v.verse, text: stripStrongs(v.text) })
                }
            }
        }
        scriptureVerses.value = allVerses
    } catch {
        scriptureVerses.value = []
    }
    scriptureLoading.value = false
}

function todayReadingRef(): string {
    if (!todayReading.value) return ''
    const r = todayReading.value
    if (r.chapter_start === r.chapter_end) return `${r.book_name} ${r.chapter_start}`
    return `${r.book_name} ${r.chapter_start}-${r.chapter_end}`
}

const scripturePreviewText = computed(() => {
    if (!scriptureVerses.value.length) return ''
    // Show first ~500 chars
    let text = ''
    for (const v of scriptureVerses.value) {
        const line = `${v.verse}. ${v.text} `
        if (text.length + line.length > 500) {
            text += line.slice(0, 500 - text.length) + '...'
            break
        }
        text += line
    }
    return text
})

// ── Events ──
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

// ── Birthdays ──
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

// ── Announcements carousel ──
const recentAnnouncements = computed(() =>
    [...announcementStore.announcements]
        .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1
            if (!a.is_pinned && b.is_pinned) return 1
            return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        })
        .slice(0, 8),
)

function prevSlide() {
    if (carouselIndex.value > 0) carouselIndex.value--
}

function nextSlide() {
    if (carouselIndex.value < recentAnnouncements.value.length - 1) carouselIndex.value++
}

// ── Helpers ──
const greeting = computed(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
})

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatEventTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
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
            <div class="absolute inset-0 opacity-[0.04]"
                style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 24px 24px;" />
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
                <!-- QR Quick Access (hidden for pending users) -->
                <button v-if="!auth.isPending" @click="showQr = true"
                    class="shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm transition-all duration-200 group cursor-pointer">
                    <svg class="w-8 h-8 text-white/80 group-hover:text-white transition-colors" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                    </svg>
                    <span class="text-[11px] font-medium text-white/70 group-hover:text-white/90 transition-colors">My
                        QR</span>
                </button>
            </div>
        </div>

        <QrCodeModal :open="showQr" @close="showQr = false" />

        <!-- Loading skeleton -->
        <template v-if="pageLoading">
            <div class="space-y-4 mb-6">
                <div class="h-48 bg-gray-200 rounded-xl animate-pulse" />
                <div class="h-56 bg-gray-200 rounded-xl animate-pulse" />
                <div class="grid grid-cols-2 gap-4">
                    <div class="h-24 bg-gray-200 rounded-xl animate-pulse" />
                    <div class="h-24 bg-gray-200 rounded-xl animate-pulse" />
                </div>
            </div>
        </template>

        <template v-else>
            <div class="grid grid-cols-12 gap-6">
                <div class="col-span-12  lg:col-span-8">
                    <!-- ═══ Daily Scripture Reading ═══ -->
                    <div v-if="todayReading"
                        class="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 rounded-xl border border-amber-200/60 p-6 sm:p-8 mb-6">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-9 h-9 rounded-lg bg-amber-200/50 flex items-center justify-center">
                                <svg class="w-5 h-5 text-amber-700" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="font-heading font-bold text-amber-900 text-lg">Daily Devotional</h2>
                                <p class="text-xs text-amber-600/70">Today's Scripture Reading</p>
                            </div>
                        </div>

                        <p class="text-2xl sm:text-3xl font-heading font-bold text-amber-800 mb-2">{{ todayReadingRef()
                        }}
                        </p>
                        <p v-if="todayReading.notes"
                            class="text-sm text-amber-700/80 mb-4 italic border-l-2 border-amber-300 pl-3">{{
                                todayReading.notes }}</p>

                        <!-- Scripture preview -->
                        <div v-if="scriptureLoading" class="flex items-center gap-2 text-sm text-amber-600/60 mb-4">
                            <div
                                class="w-4 h-4 border-2 border-amber-400/30 border-t-amber-600 rounded-full animate-spin" />
                            Loading scripture...
                        </div>
                        <div v-else-if="scripturePreviewText" class="mb-4">
                            <p class="text-sm text-gray-600 leading-relaxed">{{ scripturePreviewText }}</p>
                        </div>

                        <router-link :to="{ name: 'member-scripture', query: { date: todayReading.reading_date } }"
                            class="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            Read Full Chapter
                        </router-link>
                    </div>

                    <!-- ═══ Announcements Carousel ═══ -->
                    <div v-if="recentAnnouncements.length" class="mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <h2 class="font-heading font-semibold text-navy text-lg">Announcements</h2>
                            <router-link :to="{ name: 'member-announcements' }"
                                class="text-xs text-navy/60 hover:text-navy font-medium transition-colors">View
                                all</router-link>
                        </div>

                        <div class="relative">
                            <!-- Carousel container -->
                            <div class="overflow-hidden rounded-xl">
                                <div class="flex transition-transform duration-300 ease-in-out"
                                    :style="{ transform: `translateX(-${carouselIndex * 100}%)` }">
                                    <div v-for="a in recentAnnouncements" :key="a.id" class="w-full flex-shrink-0">
                                        <router-link :to="{ name: 'member-announcements' }"
                                            class="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                            <img v-if="a.photo_url" :src="a.photo_url"
                                                class="w-full h-48 sm:h-56 object-cover" />
                                            <div v-else
                                                class="w-full h-32 bg-gradient-to-br from-navy/5 to-navy/10 flex items-center justify-center">
                                                <svg class="w-10 h-10 text-navy/20" fill="none" stroke="currentColor"
                                                    viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="1.5"
                                                        d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" />
                                                </svg>
                                            </div>
                                            <div class="p-4">
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span v-if="a.is_pinned"
                                                        class="text-[10px] bg-gold/20 text-gold-700 px-1.5 py-0.5 rounded-full font-medium">Pinned</span>
                                                    <h3 class="text-base font-semibold text-gray-900 truncate">{{
                                                        a.title }}
                                                    </h3>
                                                </div>
                                                <p class="text-sm text-gray-500 line-clamp-2">{{ a.content }}</p>
                                                <p class="text-xs text-gray-400 mt-2">{{ a.author_name }} &middot; {{
                                                    formatDate(a.created_at ?? null) }}</p>
                                            </div>
                                        </router-link>
                                    </div>
                                </div>
                            </div>

                            <!-- Nav arrows -->
                            <button v-if="carouselIndex > 0"
                                class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-600 hover:bg-white transition-colors z-10"
                                @click="prevSlide">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <button v-if="carouselIndex < recentAnnouncements.length - 1"
                                class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-600 hover:bg-white transition-colors z-10"
                                @click="nextSlide">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <!-- Dots -->
                            <div v-if="recentAnnouncements.length > 1"
                                class="flex items-center justify-center gap-1.5 mt-3">
                                <button v-for="(_, i) in recentAnnouncements" :key="i"
                                    class="w-2 h-2 rounded-full transition-colors"
                                    :class="i === carouselIndex ? 'bg-navy' : 'bg-gray-300 hover:bg-gray-400'"
                                    @click="carouselIndex = i" />
                            </div>
                        </div>
                    </div>
                </div>
                <!-- ═══ Main Grid: Left (Announcements) + Right Sidebar ═══ -->
                <div class="grid col-span-12 lg:col-span-4 gap-6">
                    <!-- Right sidebar -->
                    <div class="space-y-6">
                        <!-- Quick Access: Devotional Wall (hidden for pending users) -->
                        <router-link v-if="!auth.isPending" :to="{ name: 'member-devotional' }"
                            class="group block bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200/60 p-5 hover:shadow-md hover:border-violet-300 transition-all">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 group-hover:bg-violet-200 transition-colors">
                                    <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-heading font-bold text-violet-900 text-base">Devotional Wall</h3>
                                    <p class="text-xs text-violet-600/70">Share thoughts & encouragements</p>
                                </div>
                            </div>
                        </router-link>

                        <!-- Quick Access: Prayer Wall (hidden for pending users) -->
                        <router-link v-if="!auth.isPending" :to="{ name: 'member-prayer-requests' }"
                            class="group block bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl border border-sky-200/60 p-5 hover:shadow-md hover:border-sky-300 transition-all">
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-200 transition-colors">
                                    <svg class="w-5 h-5 text-sky-600" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="font-heading font-bold text-sky-900 text-base">Prayer Wall</h3>
                                    <p class="text-xs text-sky-600/70">Pray together as a community</p>
                                </div>
                            </div>
                        </router-link>

                        <!-- Upcoming Events (hidden for pending users) -->
                        <div v-if="!auth.isPending" class="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                            <div class="flex items-center justify-between mb-4">
                                <h2 class="font-heading font-semibold text-navy text-lg">Upcoming Events</h2>
                                <router-link :to="{ name: 'member-events' }"
                                    class="text-xs text-navy/60 hover:text-navy font-medium transition-colors">
                                    View all
                                </router-link>
                            </div>
                            <div v-if="!upcomingEvents.length" class="text-sm text-gray-400 py-6 text-center">
                                <svg class="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                No upcoming events
                            </div>
                            <div v-else class="space-y-3">
                                <router-link v-for="evt in upcomingEvents" :key="evt.id"
                                    :to="{ name: 'member-event-detail', params: { id: evt.id } }"
                                    class="block group/event rounded-lg bg-gray-50/80 hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-200 p-3">
                                    <div class="flex items-start gap-3">
                                        <div
                                            class="w-11 h-11 rounded-lg bg-navy/[0.08] flex flex-col items-center justify-center text-navy shrink-0">
                                            <span class="text-[9px] uppercase font-semibold leading-none text-navy/60">
                                                {{ new Date(evt.duration_from!).toLocaleDateString('en', {
                                                    month:
                                                        'short'
                                                })
                                                }}
                                            </span>
                                            <span class="text-base font-heading font-bold leading-tight">
                                                {{ new Date(evt.duration_from!).getDate() }}
                                            </span>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <p class="text-sm font-semibold text-gray-900 truncate">{{ evt.event_title
                                            }}
                                            </p>
                                            <p class="text-xs text-gray-500 mt-0.5">
                                                {{ formatEventTime(evt.duration_from) }}
                                                <span v-if="evt.event_type" class="text-gray-300 mx-1">&middot;</span>
                                                <span v-if="evt.event_type" class="text-gray-400">{{ evt.event_type
                                                }}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <!-- RSVP buttons -->
                                    <div class="flex items-center gap-2 mt-2.5 ml-14" @click.prevent>
                                        <button
                                            class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                            :class="getRsvpStatus(evt.id) === 'going' ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-200'"
                                            @click="setRsvp(evt.id, 'going')">
                                            Going {{ getRsvpCount(evt.id).going > 0 ? `(${getRsvpCount(evt.id).going})`
                                                : ''
                                            }}
                                        </button>
                                        <button
                                            class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                            :class="getRsvpStatus(evt.id) === 'maybe' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-600 border border-gray-200 hover:border-amber-200'"
                                            @click="setRsvp(evt.id, 'maybe')">
                                            Maybe {{ getRsvpCount(evt.id).maybe > 0 ? `(${getRsvpCount(evt.id).maybe})`
                                                : ''
                                            }}
                                        </button>
                                        <button
                                            class="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all duration-200"
                                            :class="getRsvpStatus(evt.id) === 'not_going' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200'"
                                            @click="setRsvp(evt.id, 'not_going')">
                                            Can't Go
                                        </button>
                                    </div>
                                </router-link>
                            </div>
                        </div>

                        <!-- Birthday Reminders -->
                        <div v-if="birthdays.length" class="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                            <h2 class="font-heading font-semibold text-navy text-lg mb-4">Birthdays</h2>
                            <div class="space-y-3">
                                <div v-for="b in birthdays" :key="b.name" class="flex items-center gap-3">
                                    <div
                                        class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-navy/40 shrink-0 border border-gray-100">
                                        {{b.name.split(' ').map(n => n[0]).join('')}}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-medium text-gray-800 truncate">{{ b.name }}</p>
                                        <p class="text-xs text-gray-400">{{ b.birthday }}</p>
                                    </div>
                                    <span class="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                                        :class="b.daysUntil === 0 ? 'bg-gold/15 text-gold-700' : 'bg-gray-50 text-gray-500 border border-gray-100'">
                                        {{ b.daysUntil === 0 ? 'Today!' : `${b.daysUntil}d` }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Approval Status -->
                        <div
                            v-if="auth.profile?.status"
                            class="rounded-xl border p-5 sm:p-6"
                            :class="auth.isPending
                                ? 'bg-amber-50 border-amber-200'
                                : auth.isRejected
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-emerald-50 border-emerald-200'"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                    :class="auth.isPending
                                        ? 'bg-amber-100'
                                        : auth.isRejected
                                            ? 'bg-red-100'
                                            : 'bg-emerald-100'"
                                >
                                    <svg v-if="auth.isPending" class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <svg v-else-if="auth.isRejected" class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                    <svg v-else class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h2
                                        class="font-heading font-semibold text-base"
                                        :class="auth.isPending
                                            ? 'text-amber-900'
                                            : auth.isRejected
                                                ? 'text-red-900'
                                                : 'text-emerald-900'"
                                    >
                                        Account Status:
                                        {{ auth.isPending ? 'Pending Approval' : auth.isRejected ? 'Rejected' : 'Approved' }}
                                    </h2>
                                    <p
                                        class="text-xs mt-0.5"
                                        :class="auth.isPending
                                            ? 'text-amber-700/80'
                                            : auth.isRejected
                                                ? 'text-red-700/80'
                                                : 'text-emerald-700/80'"
                                    >
                                        <template v-if="auth.isPending">Your account is awaiting administrator approval. Some features are limited.</template>
                                        <template v-else-if="auth.isRejected">Your account has been declined. Please contact your church administrator.</template>
                                        <template v-else>You have full access to the RCMI community.</template>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Network Profile -->
                        <div class="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h2 class="font-heading font-semibold text-navy text-lg">My Network</h2>
                                    <p v-if="member.network.myRole" class="text-xs text-gray-500 mt-0.5">
                                        My Role: <span class="font-semibold text-navy">{{ member.network.myRole
                                        }}</span>
                                    </p>
                                </div>
                            </div>
                            <p v-if="member.network.myRole === 'Pastor'" class="text-sm text-gray-500">
                                You are a Pastor — no leadership hierarchy above you.
                            </p>
                            <div v-else class="space-y-3">
                                <div class="flex items-center gap-3">
                                    <div
                                        class="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                                        <svg class="w-3.5 h-3.5 text-violet-500" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Pastor
                                        </p>
                                        <p class="text-sm font-medium text-gray-800 truncate">{{
                                            member.network.pastor?.name
                                            ?? 'Not assigned' }}</p>
                                    </div>
                                </div>
                                <div v-if="member.network.myRole !== 'Network Leader'" class="flex items-center gap-3">
                                    <div
                                        class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                                            Network
                                            Leader</p>
                                        <p class="text-sm font-medium text-gray-800 truncate">{{
                                            member.network.networkLeader?.name ?? 'Not assigned' }}</p>
                                    </div>
                                </div>
                                <div v-if="member.network.myRole === 'Member'" class="flex items-center gap-3">
                                    <div
                                        class="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                        <svg class="w-3.5 h-3.5 text-teal-500" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                        </svg>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[10px] text-gray-400 uppercase tracking-wider font-medium">L-Path
                                            Leader</p>
                                        <p class="text-sm font-medium text-gray-800 truncate">{{
                                            member.network.lpathLeader?.name ?? 'Not assigned' }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Church Info -->
                        <div class="bg-gradient-to-br from-navy to-navy-700 rounded-xl p-5 sm:p-6 text-white">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-gold" fill="none" stroke="currentColor"
                                        viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                                    </svg>
                                </div>
                                <h2 class="font-heading font-semibold text-base">My Church</h2>
                            </div>
                            <p class="text-base font-semibold text-white">
                                {{ auth.profile?.satellite_church_name ?? 'Not assigned' }}
                            </p>
                            <p class="text-sm text-white/50 mt-1">Member since {{ formatDate(auth.profile?.created_at ??
                                null) }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
