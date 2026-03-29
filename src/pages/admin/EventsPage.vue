<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useEventStore } from '@/stores/event.store'
import QRCode from 'qrcode'
import type { Tables, TablesInsert } from '@/types/database.types'

type Event = Tables<'tbl_events'>

interface DefaultEvent {
    id: number
    event_title: string
    event_type: string
    day_of_week: string
    default_start_time: string
    default_end_time: string
    allow_self_checkin: boolean
    is_active: boolean
    created_at: string
}

const auth = useAuthStore()
const eventStore = useEventStore()

// Tabs & view
const activeTab = ref<'all' | 'default'>('all')
const viewMode = ref<'card' | 'list'>('card')

// Events state
const search = ref('')
const modalOpen = ref(false)
const editingEvent = ref<Event | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const churches = ref<{ id: number; church_name: string }[]>([])
const form = ref(getEventDefaults())
const deleteTarget = ref<Event | null>(null)
const showDeleteModal = ref(false)
const deleting = ref(false)

// Event QR
const showQrModal = ref(false)
const qrTarget = ref<Event | null>(null)
const qrDataUrl = ref<string | null>(null)
const qrGenerating = ref(false)

function getEventDefaults() {
    return {
        event_title: '',
        event_type: '',
        duration_from: '',
        duration_to: '',
        satellite_church_id: auth.profile?.satellite_church_id ?? null,
        remarks: '',
        is_active: true,
        allow_self_checkin: false,
    }
}

// Default events state
const defaultItems = ref<DefaultEvent[]>([])
const defaultLoading = ref(true)
const defaultModalOpen = ref(false)
const editingDefault = ref<DefaultEvent | null>(null)
const defaultSaving = ref(false)
const defaultError = ref<string | null>(null)
const defaultForm = ref(getDefaultEventDefaults())

function getDefaultEventDefaults() {
    return {
        event_title: '',
        event_type: '',
        day_of_week: 'Sunday',
        default_start_time: '09:00',
        default_end_time: '11:00',
        allow_self_checkin: true,
        is_active: true,
    }
}

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const eventTypes = ['Sunday Service', 'Midweek', 'Prayer Meeting', 'Special Event', 'L-Path', 'Outreach']

onMounted(async () => {
    await Promise.all([eventStore.fetchEvents(), fetchChurches(), fetchDefaultEvents()])
    defaultLoading.value = false
})

async function fetchChurches() {
    const { data } = await supabase.from('lib_satellite_churches').select('id, church_name').order('church_name')
    churches.value = data ?? []
}

async function fetchDefaultEvents() {
    const { data } = await supabase.from('lib_default_events').select('*').order('created_at', { ascending: true })
    defaultItems.value = (data as DefaultEvent[]) ?? []
}

// Events
const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return eventStore.events
    return eventStore.events.filter(e => e.event_title.toLowerCase().includes(q) || e.event_type?.toLowerCase().includes(q))
})

function openAddEvent() {
    editingEvent.value = null
    form.value = getEventDefaults()
    error.value = null
    modalOpen.value = true
}

function openEditEvent(event: Event) {
    editingEvent.value = event
    form.value = {
        event_title: event.event_title,
        event_type: event.event_type ?? '',
        duration_from: event.duration_from?.slice(0, 16) ?? '',
        duration_to: event.duration_to?.slice(0, 16) ?? '',
        satellite_church_id: event.satellite_church_id,
        remarks: event.remarks ?? '',
        is_active: event.is_active ?? true,
        allow_self_checkin: (event as any).allow_self_checkin ?? false,
    }
    error.value = null
    modalOpen.value = true
}

async function handleSaveEvent() {
    if (!form.value.event_title.trim()) return
    saving.value = true
    error.value = null

    const payload = {
        event_title: form.value.event_title,
        event_type: form.value.event_type || null,
        duration_from: form.value.duration_from || null,
        duration_to: form.value.duration_to || null,
        satellite_church_id: form.value.satellite_church_id,
        remarks: form.value.remarks || null,
        is_active: form.value.is_active,
        allow_self_checkin: form.value.allow_self_checkin,
    }

    let result
    if (editingEvent.value) {
        result = await eventStore.updateEvent(editingEvent.value.id, payload)
    } else {
        result = await eventStore.createEvent(payload as TablesInsert<'tbl_events'>)
    }

    if (result.success) {
        modalOpen.value = false
    } else {
        error.value = result.error ?? 'Failed to save.'
    }
    saving.value = false
}

async function handleToggle(event: Event) {
    await eventStore.toggleActive(event)
}

function openDeleteEvent(event: Event) {
    deleteTarget.value = event
    showDeleteModal.value = true
}

async function openEventQr(event: Event) {
    qrTarget.value = event
    qrDataUrl.value = null
    showQrModal.value = true
    qrGenerating.value = true
    try {
        qrDataUrl.value = await QRCode.toDataURL(`event:${event.id}`, {
            width: 400,
            margin: 2,
            color: { dark: '#091f55', light: '#ffffff' },
        })
    } catch {
        qrDataUrl.value = null
    }
    qrGenerating.value = false
}

async function handleDeleteEvent() {
    if (!deleteTarget.value) return
    deleting.value = true
    const result = await eventStore.deleteEvent(deleteTarget.value.id)
    if (!result.success) {
        error.value = result.error ?? 'Failed to delete event.'
    }
    showDeleteModal.value = false
    deleteTarget.value = null
    deleting.value = false
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Default events
const defaultActiveCount = computed(() => defaultItems.value.filter(i => i.is_active).length)

function openAddDefault() {
    editingDefault.value = null
    defaultForm.value = getDefaultEventDefaults()
    defaultError.value = null
    defaultModalOpen.value = true
}

function openEditDefault(item: DefaultEvent) {
    editingDefault.value = item
    defaultForm.value = {
        event_title: item.event_title,
        event_type: item.event_type ?? '',
        day_of_week: item.day_of_week ?? 'Sunday',
        default_start_time: item.default_start_time ?? '09:00',
        default_end_time: item.default_end_time ?? '11:00',
        allow_self_checkin: item.allow_self_checkin ?? true,
        is_active: item.is_active ?? true,
    }
    defaultError.value = null
    defaultModalOpen.value = true
}

async function handleSaveDefault() {
    if (!defaultForm.value.event_title.trim()) return
    defaultSaving.value = true
    defaultError.value = null

    try {
        const payload = {
            event_title: defaultForm.value.event_title.trim(),
            event_type: defaultForm.value.event_type || null,
            day_of_week: defaultForm.value.day_of_week,
            default_start_time: defaultForm.value.default_start_time || null,
            default_end_time: defaultForm.value.default_end_time || null,
            allow_self_checkin: defaultForm.value.allow_self_checkin,
            is_active: defaultForm.value.is_active,
        }

        if (editingDefault.value) {
            const { error: err } = await supabase.from('lib_default_events').update(payload).eq('id', editingDefault.value.id)
            if (err) throw err
        } else {
            const { error: err } = await supabase.from('lib_default_events').insert(payload)
            if (err) throw err
        }

        await fetchDefaultEvents()
        defaultModalOpen.value = false
    } catch (e: any) {
        defaultError.value = e.message ?? 'Failed to save'
    } finally {
        defaultSaving.value = false
    }
}

async function toggleDefaultActive(item: DefaultEvent) {
    await supabase.from('lib_default_events').update({ is_active: !item.is_active }).eq('id', item.id)
    await fetchDefaultEvents()
}

function formatTime(t: string | null) {
    if (!t) return '—'
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
}
</script>

<template>
    <div>
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Events</h1>
                <p v-if="activeTab === 'default'" class="text-sm text-gray-500 mt-1">
                    Recurring event templates &mdash; {{ defaultActiveCount }} active
                </p>
            </div>
            <button
                v-if="activeTab === 'all'"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAddEvent"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Event
            </button>
            <button
                v-else
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAddDefault"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Default Event
            </button>
        </div>

        <!-- Tabs + View Toggle -->
        <div class="flex items-center justify-between gap-4 mb-4">
            <!-- Tabs -->
            <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                <button
                    v-for="tab in [{ key: 'all' as const, label: 'All' }, { key: 'default' as const, label: 'Default' }]"
                    :key="tab.key"
                    class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                    :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                    @click="activeTab = tab.key"
                >
                    {{ tab.label }}
                    <span class="ml-1 text-[10px] tabular-nums" :class="activeTab === tab.key ? 'text-navy/50' : 'text-gray-300'">
                        {{ tab.key === 'all' ? eventStore.events.length : defaultItems.length }}
                    </span>
                </button>
            </div>

            <!-- View Toggle -->
            <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                <button
                    @click="viewMode = 'card'"
                    class="p-1 rounded transition-all"
                    :class="viewMode === 'card' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                    </svg>
                </button>
                <button
                    @click="viewMode = 'list'"
                    class="p-1 rounded transition-all"
                    :class="viewMode === 'list' ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- ==================== ALL EVENTS TAB ==================== -->
        <template v-if="activeTab === 'all'">
            <!-- Search -->
            <div class="mb-4">
                <input
                    v-model="search"
                    type="text"
                    placeholder="Search events..."
                    class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                />
            </div>

            <!-- Loading -->
            <div v-if="eventStore.loading" class="space-y-3">
                <div v-for="i in 4" :key="i" class="h-16 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            <!-- Empty -->
            <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No events found.</div>

            <!-- Card View -->
            <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                    v-for="evt in filtered"
                    :key="evt.id"
                    class="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
                >
                    <!-- Cover Photo -->
                    <div v-if="(evt as any).cover_photo_url" class="h-36 bg-gray-100">
                        <img :src="(evt as any).cover_photo_url" :alt="evt.event_title" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="h-24 bg-gradient-to-br from-navy/5 to-navy/10 flex items-center justify-center">
                        <svg class="w-8 h-8 text-navy/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                    </div>

                    <div class="p-4">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-semibold text-gray-900 truncate">{{ evt.event_title }}</p>
                                <span v-if="evt.event_type" class="text-[11px] text-gray-400">{{ evt.event_type }}</span>
                            </div>
                            <button
                                @click="handleToggle(evt)"
                                class="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors shrink-0"
                                :class="evt.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'"
                            >
                                {{ evt.is_active ? 'Active' : 'Inactive' }}
                            </button>
                        </div>
                        <div class="space-y-1 mb-3">
                            <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                {{ formatDate(evt.duration_from) }}
                            </div>
                            <div v-if="evt.duration_to" class="flex items-center gap-1.5 text-[11px] text-gray-400">
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {{ formatDate(evt.duration_to) }}
                            </div>
                        </div>
                        <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
                            <router-link
                                :to="{ name: 'admin-event-detail', params: { id: evt.id } }"
                                class="text-xs text-navy font-medium hover:underline"
                            >
                                View
                            </router-link>
                            <span class="text-gray-200">&middot;</span>
                            <button class="text-xs text-gray-500 hover:text-navy font-medium" @click="openEditEvent(evt)">Edit</button>
                            <span class="text-gray-200">&middot;</span>
                            <button class="text-xs text-violet-500 hover:text-violet-700 font-medium" @click="openEventQr(evt)">QR</button>
                            <span class="text-gray-200">&middot;</span>
                            <button class="text-xs text-red-400 hover:text-red-600 font-medium" @click="openDeleteEvent(evt)">Delete</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List View -->
            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Title</th>
                                <th class="px-4 py-3 hidden md:table-cell">Type</th>
                                <th class="px-4 py-3 hidden md:table-cell">From</th>
                                <th class="px-4 py-3 hidden lg:table-cell">To</th>
                                <th class="px-4 py-3 text-center">Status</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="evt in filtered" :key="evt.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3 font-medium text-gray-900">{{ evt.event_title }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ evt.event_type ?? '—' }}</td>
                                <td class="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{{ formatDate(evt.duration_from) }}</td>
                                <td class="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{{ formatDate(evt.duration_to) }}</td>
                                <td class="px-4 py-3 text-center">
                                    <button
                                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                                        :class="evt.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                        @click="handleToggle(evt)"
                                    >
                                        {{ evt.is_active ? 'Active' : 'Inactive' }}
                                    </button>
                                </td>
                                <td class="px-4 py-3 text-right space-x-2">
                                    <router-link :to="{ name: 'admin-event-detail', params: { id: evt.id } }" class="text-navy hover:text-navy-600 text-sm font-medium">View</router-link>
                                    <button class="text-gray-500 hover:text-navy text-sm font-medium" @click="openEditEvent(evt)">Edit</button>
                                    <button class="text-violet-500 hover:text-violet-700 text-sm font-medium" @click="openEventQr(evt)">QR</button>
                                    <button class="text-red-400 hover:text-red-600 text-sm font-medium" @click="openDeleteEvent(evt)">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- ==================== DEFAULT EVENTS TAB ==================== -->
        <template v-else>
            <!-- Loading -->
            <div v-if="defaultLoading" class="space-y-3">
                <div v-for="i in 4" :key="i" class="h-16 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            <!-- Empty -->
            <div v-else-if="!defaultItems.length" class="text-center py-16">
                <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <p class="text-gray-400 text-sm">No default events yet.</p>
                <button @click="openAddDefault" class="mt-3 text-sm text-navy font-semibold hover:underline">Add your first one</button>
            </div>

            <!-- Card View -->
            <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                    v-for="item in defaultItems"
                    :key="item.id"
                    class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                >
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-semibold text-gray-900 truncate">{{ item.event_title }}</p>
                            <span v-if="item.event_type" class="text-[11px] text-gray-400">{{ item.event_type }}</span>
                        </div>
                        <button
                            @click="toggleDefaultActive(item)"
                            class="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors shrink-0"
                            :class="item.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'"
                        >
                            {{ item.is_active ? 'Active' : 'Inactive' }}
                        </button>
                    </div>
                    <div class="space-y-1 mb-3">
                        <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            {{ item.day_of_week }}
                        </div>
                        <div class="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {{ formatTime(item.default_start_time) }} – {{ formatTime(item.default_end_time) }}
                        </div>
                    </div>
                    <div class="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <span v-if="item.allow_self_checkin" class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Self check-in</span>
                        <span class="flex-1" />
                        <button class="text-xs text-gray-500 hover:text-navy font-medium" @click="openEditDefault(item)">Edit</button>
                    </div>
                </div>
            </div>

            <!-- List View -->
            <div v-else-if="defaultItems.length" class="space-y-3">
                <div
                    v-for="item in defaultItems"
                    :key="item.id"
                    class="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                >
                    <!-- Day badge -->
                    <div class="w-12 h-12 rounded-lg bg-navy/5 flex flex-col items-center justify-center shrink-0">
                        <span class="text-[10px] font-semibold text-navy/50 uppercase leading-none">{{ item.day_of_week?.slice(0, 3) }}</span>
                        <span class="text-xs font-bold text-navy mt-0.5">{{ formatTime(item.default_start_time) }}</span>
                    </div>

                    <!-- Info -->
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-gray-900 truncate">{{ item.event_title }}</p>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span v-if="item.event_type" class="text-[11px] text-gray-400">{{ item.event_type }}</span>
                            <span class="text-[11px] text-gray-300">&middot;</span>
                            <span class="text-[11px] text-gray-400">{{ formatTime(item.default_start_time) }} – {{ formatTime(item.default_end_time) }}</span>
                            <span v-if="item.allow_self_checkin" class="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Self check-in</span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2 shrink-0">
                        <button
                            @click="toggleDefaultActive(item)"
                            class="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
                            :class="item.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'"
                        >
                            {{ item.is_active ? 'Active' : 'Inactive' }}
                        </button>
                        <button
                            @click="openEditDefault(item)"
                            class="p-1.5 rounded-lg text-gray-400 hover:text-navy hover:bg-gray-100 transition-colors"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <!-- ==================== EVENT MODAL ==================== -->
        <Teleport to="body">
            <div
                v-if="modalOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                @click.self="modalOpen = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">
                            {{ editingEvent ? 'Edit Event' : 'New Event' }}
                        </h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="modalOpen = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleSaveEvent">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                            <input v-model="form.event_title" type="text" required class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select v-model="form.event_type" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
                                    <option value="">Select type</option>
                                    <option v-for="t in eventTypes" :key="t" :value="t">{{ t }}</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                                <select v-model="form.satellite_church_id" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/20">
                                    <option :value="null">All churches</option>
                                    <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Start</label>
                                <input v-model="form.duration_from" type="datetime-local" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">End</label>
                                <input v-model="form.duration_to" type="datetime-local" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                            <textarea v-model="form.remarks" rows="2" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none" />
                        </div>
                        <div class="flex flex-col gap-3">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input v-model="form.is_active" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                                <span class="text-sm text-gray-700">Active</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input v-model="form.allow_self_checkin" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                                <span class="text-sm text-gray-700">Allow Self Check-In</span>
                            </label>
                        </div>
                        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>
                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" class="px-4 py-2.5 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 text-sm" @click="modalOpen = false">Cancel</button>
                            <button type="submit" :disabled="saving" class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50">
                                {{ saving ? 'Saving...' : (editingEvent ? 'Update' : 'Create') }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- ==================== DEFAULT EVENT MODAL ==================== -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div v-if="defaultModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="defaultModalOpen = false" />

                    <div class="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                        <h2 class="text-lg font-heading font-bold text-navy mb-5">
                            {{ editingDefault ? 'Edit Default Event' : 'Add Default Event' }}
                        </h2>

                        <form @submit.prevent="handleSaveDefault" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                                <input v-model="defaultForm.event_title" type="text" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" placeholder="e.g. Sunday Service" required />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                                <select v-model="defaultForm.event_type" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white">
                                    <option value="">Select type</option>
                                    <option v-for="t in eventTypes" :key="t" :value="t">{{ t }}</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                                <select v-model="defaultForm.day_of_week" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white">
                                    <option v-for="d in daysOfWeek" :key="d" :value="d">{{ d }}</option>
                                </select>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input v-model="defaultForm.default_start_time" type="time" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                    <input v-model="defaultForm.default_end_time" type="time" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
                                </div>
                            </div>
                            <div class="flex items-center gap-6">
                                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input v-model="defaultForm.allow_self_checkin" type="checkbox" class="rounded border-gray-300 text-navy focus:ring-navy/30" />
                                    Self check-in
                                </label>
                                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input v-model="defaultForm.is_active" type="checkbox" class="rounded border-gray-300 text-navy focus:ring-navy/30" />
                                    Active
                                </label>
                            </div>
                            <p v-if="defaultError" class="text-xs text-red-500">{{ defaultError }}</p>
                            <div class="flex gap-3 pt-2">
                                <button type="button" @click="defaultModalOpen = false" class="flex-1 py-2.5 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm">Cancel</button>
                                <button type="submit" :disabled="defaultSaving" class="flex-1 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors text-sm">
                                    {{ defaultSaving ? 'Saving...' : (editingDefault ? 'Update' : 'Create') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
        <!-- ==================== EVENT QR MODAL ==================== -->
        <Teleport to="body">
            <div
                v-if="showQrModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                @click.self="showQrModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
                    <button
                        @click="showQrModal = false"
                        class="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <h3 class="text-lg font-heading font-bold text-navy mb-1">Event QR Code</h3>
                    <p class="text-sm text-gray-500 mb-4">{{ qrTarget?.event_title }}</p>

                    <div v-if="qrGenerating" class="w-64 h-64 mx-auto bg-gray-100 rounded-lg animate-pulse" />
                    <div v-else-if="qrDataUrl" class="flex justify-center mb-4">
                        <img :src="qrDataUrl" alt="Event QR" class="w-64 h-64 rounded-lg" />
                    </div>

                    <p class="text-xs text-gray-400 mb-4">Members can scan this QR to check in to this event</p>

                    <div class="flex justify-center gap-3">
                        <button
                            v-if="qrDataUrl"
                            @click="(() => { const a = document.createElement('a'); a.href = qrDataUrl!; a.download = `event-qr-${qrTarget?.id}.png`; a.click() })()"
                            class="inline-flex items-center gap-1.5 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download
                        </button>
                        <button
                            @click="showQrModal = false"
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- ==================== DELETE CONFIRMATION MODAL ==================== -->
        <Teleport to="body">
            <div
                v-if="showDeleteModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
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
                            <h3 class="text-lg font-heading font-bold text-gray-900">Delete Event</h3>
                            <p class="text-sm text-gray-500">This action cannot be undone.</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 mb-5">
                        Are you sure you want to delete <strong>{{ deleteTarget?.event_title }}</strong>? All associated attendance logs may be affected.
                    </p>
                    <div class="flex justify-end gap-3">
                        <button
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showDeleteModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="deleting"
                            class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            @click="handleDeleteEvent"
                        >
                            {{ deleting ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
