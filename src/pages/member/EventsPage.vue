<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useRsvp } from '@/composables/useRsvp'
import type { Tables } from '@/types/database.types'

type Event = Tables<'tbl_events'>

const auth = useAuthStore()
const router = useRouter()
const { rsvps, rsvpCounts, fetchRsvps, setRsvp } = useRsvp()

const events = ref<Event[]>([])
const loading = ref(true)
const tab = ref<'upcoming' | 'past'>('upcoming')

onMounted(async () => {
    await fetchEvents()
    loading.value = false
})

async function fetchEvents() {
    const churchId = auth.profile?.satellite_church_id

    let query = supabase
        .from('tbl_events')
        .select('*')
        .eq('is_active', true)
        .order('duration_from', { ascending: false })

    if (churchId) {
        query = query.or(`satellite_church_id.eq.${churchId},satellite_church_id.is.null`)
    }

    const { data } = await query
    events.value = data ?? []

    if (data?.length) {
        await fetchRsvps(data.map((e) => e.id))
    }
}

const now = new Date().toISOString()

const upcoming = computed(() =>
    events.value
        .filter((e) => (e.duration_to ?? e.duration_from ?? '') >= now)
        .sort((a, b) => (a.duration_from ?? '').localeCompare(b.duration_from ?? '')),
)

const past = computed(() =>
    events.value
        .filter((e) => (e.duration_to ?? e.duration_from ?? '') < now)
        .sort((a, b) => (b.duration_from ?? '').localeCompare(a.duration_from ?? '')),
)

const filtered = computed(() => tab.value === 'upcoming' ? upcoming.value : past.value)

function getRsvpStatus(eventId: number) {
    return rsvps.value.get(eventId)?.status ?? null
}

function getRsvpCount(eventId: number) {
    return rsvpCounts.value.get(eventId) ?? { going: 0, maybe: 0 }
}

function formatDate(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(d: string | null) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function viewEvent(evt: Event) {
    router.push({ name: 'member-event-detail', params: { id: evt.id } })
}
</script>

<template>
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl sm:text-3xl font-heading font-bold text-navy">Events</h1>
                <p class="text-sm text-gray-400 mt-1">Discover and RSVP to church events</p>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex items-center bg-gray-50 rounded-xl p-1 border border-gray-100 w-fit mb-6">
            <button
                class="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                :class="tab === 'upcoming' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="tab = 'upcoming'"
            >
                Upcoming ({{ upcoming.length }})
            </button>
            <button
                class="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                :class="tab === 'past' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="tab = 'past'"
            >
                Past ({{ past.length }})
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div v-for="i in 6" :key="i" class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
                <div class="h-44 bg-gray-200" />
                <div class="p-5 space-y-3">
                    <div class="h-4 bg-gray-200 rounded w-3/4" />
                    <div class="h-3 bg-gray-200 rounded w-1/2" />
                </div>
            </div>
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-16">
            <svg class="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p class="text-gray-400 text-sm">No {{ tab }} events</p>
        </div>

        <!-- Card Grid -->
        <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
                v-for="evt in filtered"
                :key="evt.id"
                class="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-300 cursor-pointer"
                @click="viewEvent(evt)"
            >
                <!-- Cover Photo -->
                <div class="relative h-44 bg-gradient-to-br from-navy/10 to-navy/5 overflow-hidden">
                    <img
                        v-if="(evt as any).cover_photo_url"
                        :src="(evt as any).cover_photo_url"
                        :alt="evt.event_title"
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                        <svg class="w-12 h-12 text-navy/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                        </svg>
                    </div>
                    <!-- Date badge -->
                    <div class="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm">
                        <p class="text-[10px] uppercase font-semibold text-navy/60 leading-none">
                            {{ evt.duration_from ? new Date(evt.duration_from).toLocaleDateString('en', { month: 'short' }) : '' }}
                        </p>
                        <p class="text-lg font-heading font-bold text-navy leading-tight">
                            {{ evt.duration_from ? new Date(evt.duration_from).getDate() : '' }}
                        </p>
                    </div>
                    <!-- Type badge -->
                    <div v-if="evt.event_type" class="absolute top-3 right-3 bg-navy/80 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-lg">
                        {{ evt.event_type }}
                    </div>
                </div>

                <!-- Content -->
                <div class="p-5">
                    <h3 class="text-base font-heading font-semibold text-gray-900 mb-1.5 truncate">{{ evt.event_title }}</h3>
                    <div class="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {{ formatDate(evt.duration_from) }} {{ formatTime(evt.duration_from) }}
                        <span v-if="evt.duration_to"> — {{ formatTime(evt.duration_to) }}</span>
                    </div>
                    <p v-if="evt.remarks" class="text-xs text-gray-500 line-clamp-2 mb-4">{{ evt.remarks }}</p>

                    <!-- RSVP row -->
                    <div class="flex items-center justify-between pt-3 border-t border-gray-100" @click.stop>
                        <div class="flex items-center gap-1.5">
                            <button
                                class="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200"
                                :class="getRsvpStatus(evt.id) === 'going' ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-600 border border-gray-100 hover:border-green-200'"
                                @click="setRsvp(evt.id, 'going')"
                            >
                                Going {{ getRsvpCount(evt.id).going > 0 ? `(${getRsvpCount(evt.id).going})` : '' }}
                            </button>
                            <button
                                class="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all duration-200"
                                :class="getRsvpStatus(evt.id) === 'maybe' ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-600 border border-gray-100 hover:border-amber-200'"
                                @click="setRsvp(evt.id, 'maybe')"
                            >
                                Maybe {{ getRsvpCount(evt.id).maybe > 0 ? `(${getRsvpCount(evt.id).maybe})` : '' }}
                            </button>
                        </div>
                        <svg class="w-4 h-4 text-gray-300 group-hover:text-navy transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
