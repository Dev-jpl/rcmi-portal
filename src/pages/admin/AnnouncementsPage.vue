<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAnnouncementStore, type Announcement } from '@/stores/announcement.store'

const store = useAnnouncementStore()
const modalOpen = ref(false)
const editing = ref<Announcement | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)

const form = ref({ title: '', content: '', is_pinned: false })

function openAdd() {
    editing.value = null
    form.value = { title: '', content: '', is_pinned: false }
    modalOpen.value = true
}

function openEdit(a: Announcement) {
    editing.value = a
    form.value = { title: a.title, content: a.content, is_pinned: a.is_pinned }
    modalOpen.value = true
}

async function handleSave() {
    if (!form.value.title.trim()) return
    saving.value = true
    error.value = null

    let result
    if (editing.value) {
        result = await store.updateAnnouncement(editing.value.id, form.value)
    } else {
        result = await store.createAnnouncement(form.value.title, form.value.content, form.value.is_pinned)
    }

    if (result.success) {
        modalOpen.value = false
    } else {
        error.value = result.error ?? 'Failed to save.'
    }
    saving.value = false
}

async function handleDelete(a: Announcement) {
    if (!confirm(`Delete "${a.title}"?`)) return
    await store.deleteAnnouncement(a.id)
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

onMounted(() => store.fetchAnnouncements())
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 class="text-2xl font-heading font-bold text-navy">Announcements</h1>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Announcement
            </button>
        </div>

        <div v-if="store.loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="store.announcements.length === 0" class="text-center py-12 text-gray-400">
            No announcements yet. Create one to get started.
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="a in store.announcements"
                :key="a.id"
                class="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-4"
                :class="{ 'border-gold': a.is_pinned }"
            >
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span v-if="a.is_pinned" class="text-[10px] bg-gold/20 text-gold-700 px-1.5 py-0.5 rounded-full font-medium">
                            Pinned
                        </span>
                        <h3 class="text-sm font-semibold text-gray-900 truncate">{{ a.title }}</h3>
                    </div>
                    <p class="text-xs text-gray-500 line-clamp-2 mb-1">{{ a.content }}</p>
                    <p class="text-xs text-gray-400">{{ a.author_name }} &middot; {{ formatDate(a.created_at) }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button class="text-sm text-navy hover:underline" @click="openEdit(a)">Edit</button>
                    <button class="text-sm text-red-500 hover:underline" @click="handleDelete(a)">Delete</button>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <Teleport to="body">
            <div
                v-if="modalOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="modalOpen = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">
                            {{ editing ? 'Edit Announcement' : 'New Announcement' }}
                        </h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="modalOpen = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleSave">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                            <input
                                v-model="form.title"
                                type="text"
                                required
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                            <textarea
                                v-model="form.content"
                                rows="4"
                                required
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input v-model="form.is_pinned" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                            <span class="text-sm text-gray-700">Pin this announcement</span>
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
                                {{ saving ? 'Saving...' : (editing ? 'Update' : 'Publish') }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>
    </div>
</template>
