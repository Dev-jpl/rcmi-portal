<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import type { Tables } from '@/types/database.types'

type Event = Tables<'tbl_events'>

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const event = ref<Event | null>(null)
const loading = ref(true)
const rsvpTab = ref<'going' | 'maybe' | 'not_going'>('going')

interface RsvpEntry {
    id: string
    user_id: string
    status: 'going' | 'maybe' | 'not_going'
    created_at: string
    first_name?: string
    last_name?: string
    email?: string
}

const allRsvps = ref<RsvpEntry[]>([])
const myRsvpStatus = ref<string | null>(null)
const myRsvpId = ref<string | null>(null)
const rsvpLoading = ref(false)

onMounted(async () => {
    await Promise.all([fetchEvent(), fetchRsvps(), fetchPosts()])
    loading.value = false
})

async function fetchEvent() {
    const id = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_events')
        .select('*')
        .eq('id', id)
        .single()
    event.value = data
}

async function fetchRsvps() {
    const eventId = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_event_rsvps')
        .select('id, user_id, status, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

    if (!data) return

    // Fetch member names
    const userIds = data.map((r: any) => r.user_id)
    const { data: profiles } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds)

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
    )

    allRsvps.value = data.map((r: any) => {
        const profile = profileMap.get(r.user_id)
        return {
            ...r,
            first_name: profile?.first_name ?? '',
            last_name: profile?.last_name ?? '',
            email: profile?.email ?? '',
        }
    })

    // Set current user RSVP
    const userId = auth.session?.user?.id
    const mine = data.find((r: any) => r.user_id === userId)
    if (mine) {
        myRsvpStatus.value = (mine as any).status
        myRsvpId.value = (mine as any).id
    }
}

async function handleRsvp(status: 'going' | 'maybe' | 'not_going') {
    if (!auth.session?.user) return
    rsvpLoading.value = true

    const eventId = Number(route.params.id)

    if (myRsvpId.value) {
        if (myRsvpStatus.value === status) {
            // Toggle off
            await supabase.from('tbl_event_rsvps').delete().eq('id', myRsvpId.value)
            myRsvpStatus.value = null
            myRsvpId.value = null
        } else {
            await supabase.from('tbl_event_rsvps').update({ status }).eq('id', myRsvpId.value)
            myRsvpStatus.value = status
        }
    } else {
        const { data } = await supabase
            .from('tbl_event_rsvps')
            .insert({ event_id: eventId, user_id: auth.session.user.id, status })
            .select()
            .single()
        if (data) {
            myRsvpStatus.value = status
            myRsvpId.value = (data as any).id
        }
    }

    await fetchRsvps()
    rsvpLoading.value = false
}

// Event Posts (Facebook-style discussion)
interface EventPost {
    id: number
    event_id: number
    user_id: string
    content: string
    created_at: string
    first_name?: string
    last_name?: string
    profile_photo_url?: string | null
}

const posts = ref<EventPost[]>([])
const newPostContent = ref('')
const postingComment = ref(false)

async function fetchPosts() {
    const eventId = Number(route.params.id)
    const { data } = await supabase
        .from('tbl_event_posts')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

    if (!data) return

    const userIds = [...new Set(data.map((p: any) => p.user_id))]
    const { data: profiles } = await supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name, profile_photo_url')
        .in('user_id', userIds)

    const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p]),
    )

    posts.value = data.map((p: any) => {
        const profile = profileMap.get(p.user_id)
        return {
            ...p,
            first_name: profile?.first_name ?? '',
            last_name: profile?.last_name ?? '',
            profile_photo_url: profile?.profile_photo_url ?? null,
        }
    })
}

async function submitPost() {
    if (!newPostContent.value.trim() || !auth.session?.user) return
    postingComment.value = true

    await supabase.from('tbl_event_posts').insert({
        event_id: Number(route.params.id),
        user_id: auth.session.user.id,
        content: newPostContent.value.trim(),
    })

    newPostContent.value = ''
    await fetchPosts()
    postingComment.value = false
}

async function deletePost(postId: number) {
    await supabase.from('tbl_event_posts').delete().eq('id', postId)
    await fetchPosts()
}

function formatPostTime(d: string) {
    const now = new Date()
    const date = new Date(d)
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

const goingList = computed(() => allRsvps.value.filter((r) => r.status === 'going'))
const maybeList = computed(() => allRsvps.value.filter((r) => r.status === 'maybe'))
const notGoingList = computed(() => allRsvps.value.filter((r) => r.status === 'not_going'))

const activeList = computed(() => {
    switch (rsvpTab.value) {
        case 'going': return goingList.value
        case 'maybe': return maybeList.value
        case 'not_going': return notGoingList.value
    }
})

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function formatFullDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(first: string, last: string) {
    return (first?.[0] ?? '') + (last?.[0] ?? '')
}

function generateGoogleCalUrl() {
    if (!event.value) return '#'
    const title = encodeURIComponent(event.value.event_title)
    const start = event.value.duration_from ? new Date(event.value.duration_from).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : ''
    const end = event.value.duration_to ? new Date(event.value.duration_to).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : ''
    const details = encodeURIComponent(event.value.remarks ?? '')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}`
}
</script>

<template>
    <div class="max-w-4xl mx-auto">
        <!-- Back -->
        <button
            class="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy font-medium mb-6 transition-colors"
            @click="router.push({ name: 'member-events' })"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Events
        </button>

        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
            <div class="h-64 bg-gray-200 rounded-2xl animate-pulse" />
            <div class="h-8 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div class="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
        </div>

        <template v-else-if="event">
            <!-- Cover Photo -->
            <div class="relative rounded-2xl overflow-hidden mb-6">
                <div class="h-56 sm:h-72 bg-gradient-to-br from-navy/10 to-navy/5">
                    <img
                        v-if="(event as any).cover_photo_url"
                        :src="(event as any).cover_photo_url"
                        :alt="event.event_title"
                        class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                        <svg class="w-16 h-16 text-navy/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                    </div>
                </div>
                <!-- Type badge -->
                <div v-if="event.event_type" class="absolute top-4 right-4 bg-navy/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                    {{ event.event_type }}
                </div>
            </div>

            <!-- Event Info -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-6">
                <h1 class="text-2xl sm:text-3xl font-heading font-bold text-navy mb-4">{{ event.event_title }}</h1>

                <div class="grid sm:grid-cols-2 gap-4 mb-6">
                    <div class="flex items-start gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-navy/6 flex items-center justify-center shrink-0 mt-0.5">
                            <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-gray-900">{{ formatDate(event.duration_from) }}</p>
                            <p class="text-xs text-gray-400 mt-0.5">
                                {{ formatTime(event.duration_from) }}
                                <template v-if="event.duration_to"> — {{ formatTime(event.duration_to) }}</template>
                            </p>
                        </div>
                    </div>
                    <div class="flex items-start gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-navy/6 flex items-center justify-center shrink-0 mt-0.5">
                            <svg class="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-gray-900">{{ goingList.length + maybeList.length }} interested</p>
                            <p class="text-xs text-gray-400 mt-0.5">{{ goingList.length }} going &middot; {{ maybeList.length }} maybe</p>
                        </div>
                    </div>
                </div>

                <!-- Description -->
                <div v-if="event.remarks" class="mb-6">
                    <h3 class="text-sm font-semibold text-gray-900 mb-2">About this event</h3>
                    <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{{ event.remarks }}</p>
                </div>

                <!-- Meta -->
                <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400 pt-4 border-t border-gray-100">
                    <span v-if="event.created_by_name">Created by {{ event.created_by_name }}</span>
                    <span v-if="event.created_at">&middot; {{ formatFullDate(event.created_at) }}</span>
                </div>
            </div>

            <!-- RSVP Actions -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-6">
                <h2 class="font-heading font-semibold text-navy text-lg mb-4">Your Response</h2>
                <div class="flex flex-wrap gap-3" :class="{ 'opacity-50 pointer-events-none': rsvpLoading }">
                    <button
                        class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        :class="myRsvpStatus === 'going' ? 'bg-green-100 text-green-700 ring-2 ring-green-200' : 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600 border border-gray-200 hover:border-green-200'"
                        @click="handleRsvp('going')"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Going
                    </button>
                    <button
                        class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        :class="myRsvpStatus === 'maybe' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-600 border border-gray-200 hover:border-amber-200'"
                        @click="handleRsvp('maybe')"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                        Maybe
                    </button>
                    <button
                        class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        :class="myRsvpStatus === 'not_going' ? 'bg-red-50 text-red-600 ring-2 ring-red-200' : 'bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200 hover:border-red-200'"
                        @click="handleRsvp('not_going')"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Can't Go
                    </button>

                    <!-- Google Calendar -->
                    <a
                        :href="generateGoogleCalUrl()"
                        target="_blank"
                        class="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors ml-auto"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        Add to Calendar
                    </a>
                </div>
            </div>

            <!-- RSVP Lists -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                <h2 class="font-heading font-semibold text-navy text-lg mb-5">Responses</h2>

                <!-- Tabs -->
                <div class="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 mb-5">
                    <button
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                        :class="rsvpTab === 'going' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                        @click="rsvpTab = 'going'"
                    >
                        Going ({{ goingList.length }})
                    </button>
                    <button
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                        :class="rsvpTab === 'maybe' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                        @click="rsvpTab = 'maybe'"
                    >
                        Maybe ({{ maybeList.length }})
                    </button>
                    <button
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                        :class="rsvpTab === 'not_going' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                        @click="rsvpTab = 'not_going'"
                    >
                        Can't Go ({{ notGoingList.length }})
                    </button>
                </div>

                <!-- List -->
                <div v-if="!activeList.length" class="text-center py-8 text-gray-400 text-sm">
                    No responses yet
                </div>
                <div v-else class="space-y-2">
                    <div
                        v-for="person in activeList"
                        :key="person.id"
                        class="flex items-center gap-3.5 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        <div class="w-10 h-10 rounded-xl bg-navy/6 flex items-center justify-center text-sm font-bold text-navy/50 shrink-0">
                            {{ getInitials(person.first_name ?? '', person.last_name ?? '') }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-900 truncate">
                                {{ person.first_name }} {{ person.last_name }}
                                <span v-if="person.user_id === auth.session?.user?.id" class="text-xs text-navy/40 ml-1">(You)</span>
                            </p>
                            <p class="text-xs text-gray-400 truncate">{{ person.email }}</p>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Discussion / Posts -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                <h2 class="font-heading font-semibold text-navy text-lg mb-5">Discussion</h2>

                <!-- New Post -->
                <div class="flex items-start gap-3 mb-6">
                    <div class="w-9 h-9 rounded-full bg-navy/6 flex items-center justify-center text-xs font-bold text-navy/50 shrink-0">
                        {{ (auth.user?.first_name?.[0] ?? '') + (auth.user?.last_name?.[0] ?? '') }}
                    </div>
                    <div class="flex-1">
                        <textarea
                            v-model="newPostContent"
                            rows="2"
                            placeholder="Write something about this event..."
                            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy resize-none"
                        />
                        <div class="flex justify-end mt-2">
                            <button
                                @click="submitPost"
                                :disabled="!newPostContent.trim() || postingComment"
                                class="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                            >
                                {{ postingComment ? 'Posting...' : 'Post' }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Posts List -->
                <div v-if="!posts.length" class="text-center py-8 text-gray-400 text-sm">
                    No posts yet. Be the first to start the discussion!
                </div>
                <div v-else class="space-y-4">
                    <div
                        v-for="post in posts"
                        :key="post.id"
                        class="flex items-start gap-3 p-4 rounded-xl bg-gray-50/80 border border-transparent hover:border-gray-100 transition-all"
                    >
                        <img
                            v-if="post.profile_photo_url"
                            :src="post.profile_photo_url"
                            class="w-9 h-9 rounded-full object-cover shrink-0"
                        />
                        <div v-else class="w-9 h-9 rounded-full bg-navy/6 flex items-center justify-center text-xs font-bold text-navy/50 shrink-0">
                            {{ (post.first_name?.[0] ?? '') + (post.last_name?.[0] ?? '') }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-semibold text-gray-900">
                                    {{ post.first_name }} {{ post.last_name }}
                                    <span v-if="post.user_id === auth.session?.user?.id" class="text-xs text-navy/40 font-normal ml-1">(You)</span>
                                </p>
                                <span class="text-[11px] text-gray-300">{{ formatPostTime(post.created_at) }}</span>
                            </div>
                            <p class="text-sm text-gray-600 mt-1 whitespace-pre-line">{{ post.content }}</p>
                        </div>
                        <!-- Delete own post -->
                        <button
                            v-if="post.user_id === auth.session?.user?.id"
                            @click="deletePost(post.id)"
                            class="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            title="Delete post"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <!-- Not found -->
        <div v-else class="text-center py-16 text-gray-400">
            <p class="text-sm">Event not found</p>
        </div>
    </div>
</template>
