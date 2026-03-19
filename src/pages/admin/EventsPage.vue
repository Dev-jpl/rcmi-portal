<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useEventStore } from '@/stores/event.store'
import type { Tables, TablesInsert } from '@/types/database.types'

type Event = Tables<'tbl_events'>

const auth = useAuthStore()
const eventStore = useEventStore()

const search = ref('')
const modalOpen = ref(false)
const editingEvent = ref<Event | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const churches = ref<{ id: number; church_name: string }[]>([])

const form = ref(getDefaults())

function getDefaults() {
    return {
        event_title: '',
        event_type: '',
        duration_from: '',
        duration_to: '',
        satellite_church_id: auth.profile?.satellite_church_id ?? null,
        remarks: '',
        is_active: true,
    }
}

onMounted(async () => {
    await Promise.all([eventStore.fetchEvents(), fetchChurches()])
})

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
}

const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return eventStore.events
    return eventStore.events.filter(
        (e) =>
            e.event_title.toLowerCase().includes(q) ||
            e.event_type?.toLowerCase().includes(q),
    )
})

function openAdd() {
    editingEvent.value = null
    form.value = getDefaults()
    modalOpen.value = true
}

function openEdit(event: Event) {
    editingEvent.value = event
    form.value = {
        event_title: event.event_title,
        event_type: event.event_type ?? '',
        duration_from: event.duration_from?.slice(0, 16) ?? '',
        duration_to: event.duration_to?.slice(0, 16) ?? '',
        satellite_church_id: event.satellite_church_id,
        remarks: event.remarks ?? '',
        is_active: event.is_active ?? true,
    }
    modalOpen.value = true
}

async function handleSave() {
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

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 class="text-2xl font-heading font-bold text-navy">Events</h1>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Event
            </button>
        </div>

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

        <!-- Table -->
        <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                            <td class="px-4 py-3 text-right">
                                <button class="text-navy hover:text-navy-600 text-sm font-medium" @click="openEdit(evt)">
                                    Edit
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Event Modal -->
        <Teleport to="body">
            <div
                v-if="modalOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="modalOpen = false"
            >
                <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">
                            {{ editingEvent ? 'Edit Event' : 'New Event' }}
                        </h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="modalOpen = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleSave">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                            <input
                                v-model="form.event_title"
                                type="text"
                                required
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                            />
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                    v-model="form.event_type"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                >
                                    <option value="">Select type</option>
                                    <option value="Sunday Service">Sunday Service</option>
                                    <option value="Midweek">Midweek</option>
                                    <option value="Prayer Meeting">Prayer Meeting</option>
                                    <option value="Special Event">Special Event</option>
                                    <option value="L-Path">L-Path</option>
                                    <option value="Outreach">Outreach</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                                <select
                                    v-model="form.satellite_church_id"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                                >
                                    <option :value="null">All churches</option>
                                    <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Start</label>
                                <input
                                    v-model="form.duration_from"
                                    type="datetime-local"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">End</label>
                                <input
                                    v-model="form.duration_to"
                                    type="datetime-local"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                            <textarea
                                v-model="form.remarks"
                                rows="2"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input v-model="form.is_active" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                            <span class="text-sm text-gray-700">Active</span>
                        </label>

                        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>

                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" class="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="modalOpen = false">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ saving ? 'Saving...' : (editingEvent ? 'Update' : 'Create') }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>
    </div>
</template>
