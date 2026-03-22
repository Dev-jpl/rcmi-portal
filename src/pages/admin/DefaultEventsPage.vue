<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()

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

const items = ref<DefaultEvent[]>([])
const loading = ref(true)
const modalOpen = ref(false)
const editingItem = ref<DefaultEvent | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const form = ref(getDefaults())

function getDefaults() {
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
    await fetchItems()
    loading.value = false
})

async function fetchItems() {
    const { data } = await supabase
        .from('lib_default_events')
        .select('*')
        .order('created_at', { ascending: true })
    items.value = (data as DefaultEvent[]) ?? []
}

function openAdd() {
    editingItem.value = null
    form.value = getDefaults()
    error.value = null
    modalOpen.value = true
}

function openEdit(item: DefaultEvent) {
    editingItem.value = item
    form.value = {
        event_title: item.event_title,
        event_type: item.event_type ?? '',
        day_of_week: item.day_of_week ?? 'Sunday',
        default_start_time: item.default_start_time ?? '09:00',
        default_end_time: item.default_end_time ?? '11:00',
        allow_self_checkin: item.allow_self_checkin ?? true,
        is_active: item.is_active ?? true,
    }
    error.value = null
    modalOpen.value = true
}

async function handleSave() {
    if (!form.value.event_title.trim()) return
    saving.value = true
    error.value = null

    try {
        const payload = {
            event_title: form.value.event_title.trim(),
            event_type: form.value.event_type || null,
            day_of_week: form.value.day_of_week,
            default_start_time: form.value.default_start_time || null,
            default_end_time: form.value.default_end_time || null,
            allow_self_checkin: form.value.allow_self_checkin,
            is_active: form.value.is_active,
        }

        if (editingItem.value) {
            const { error: err } = await supabase
                .from('lib_default_events')
                .update(payload)
                .eq('id', editingItem.value.id)
            if (err) throw err
        } else {
            const { error: err } = await supabase
                .from('lib_default_events')
                .insert(payload)
            if (err) throw err
        }

        await fetchItems()
        modalOpen.value = false
    } catch (e: any) {
        error.value = e.message ?? 'Failed to save'
    } finally {
        saving.value = false
    }
}

async function toggleActive(item: DefaultEvent) {
    await supabase
        .from('lib_default_events')
        .update({ is_active: !item.is_active })
        .eq('id', item.id)
    await fetchItems()
}

function formatTime(t: string | null) {
    if (!t) return '—'
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
}

const activeCount = computed(() => items.value.filter(i => i.is_active).length)
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Default Events</h1>
                <p class="text-sm text-gray-500 mt-1">
                    Manage recurring event templates &mdash; {{ activeCount }} active
                </p>
            </div>
            <button
                @click="openAdd"
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Default Event
            </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-16 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!items.length" class="text-center py-16">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p class="text-gray-400 text-sm">No default events yet.</p>
            <button @click="openAdd" class="mt-3 text-sm text-navy font-semibold hover:underline">Add your first one</button>
        </div>

        <!-- List -->
        <div v-else class="space-y-3">
            <div
                v-for="item in items"
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
                        @click="toggleActive(item)"
                        class="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
                        :class="item.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'"
                    >
                        {{ item.is_active ? 'Active' : 'Inactive' }}
                    </button>
                    <button
                        @click="openEdit(item)"
                        class="p-1.5 rounded-lg text-gray-400 hover:text-navy hover:bg-gray-100 transition-colors"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <Teleport to="body">
            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="modalOpen = false" />

                    <div class="relative bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
                        <h2 class="text-lg font-heading font-bold text-navy mb-5">
                            {{ editingItem ? 'Edit Default Event' : 'Add Default Event' }}
                        </h2>

                        <form @submit.prevent="handleSave" class="space-y-4">
                            <!-- Event Title -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
                                <input
                                    v-model="form.event_title"
                                    type="text"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                                    placeholder="e.g. Sunday Service"
                                    required
                                />
                            </div>

                            <!-- Event Type -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                                <select
                                    v-model="form.event_type"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white"
                                >
                                    <option value="">Select type</option>
                                    <option v-for="t in eventTypes" :key="t" :value="t">{{ t }}</option>
                                </select>
                            </div>

                            <!-- Day of Week -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                                <select
                                    v-model="form.day_of_week"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white"
                                >
                                    <option v-for="d in daysOfWeek" :key="d" :value="d">{{ d }}</option>
                                </select>
                            </div>

                            <!-- Time Range -->
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input
                                        v-model="form.default_start_time"
                                        type="time"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                    <input
                                        v-model="form.default_end_time"
                                        type="time"
                                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                                    />
                                </div>
                            </div>

                            <!-- Toggles -->
                            <div class="flex items-center gap-6">
                                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input v-model="form.allow_self_checkin" type="checkbox" class="rounded border-gray-300 text-navy focus:ring-navy/30" />
                                    Self check-in
                                </label>
                                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <input v-model="form.is_active" type="checkbox" class="rounded border-gray-300 text-navy focus:ring-navy/30" />
                                    Active
                                </label>
                            </div>

                            <!-- Error -->
                            <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

                            <!-- Actions -->
                            <div class="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    @click="modalOpen = false"
                                    class="flex-1 py-2.5 border border-gray-200 text-gray-500 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    :disabled="saving"
                                    class="flex-1 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors text-sm"
                                >
                                    {{ saving ? 'Saving...' : (editingItem ? 'Update' : 'Create') }}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
