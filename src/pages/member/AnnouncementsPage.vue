<script setup lang="ts">
import { onMounted } from 'vue'
import { useAnnouncementStore } from '@/stores/announcement.store'

const store = useAnnouncementStore()

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

onMounted(() => store.fetchAnnouncements())
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Announcements</h1>

        <div v-if="store.loading" class="text-center py-8 text-gray-400">Loading announcements...</div>

        <div v-else-if="store.announcements.length === 0" class="text-center py-12 text-gray-400">
            No announcements at this time.
        </div>

        <div v-else class="space-y-4">
            <div
                v-for="a in store.announcements"
                :key="a.id"
                class="bg-white rounded-xl border border-gray-200 p-5"
                :class="{ 'border-gold ring-1 ring-gold/30': a.is_pinned }"
            >
                <img v-if="a.photo_url" :src="a.photo_url" class="w-full rounded-lg object-cover mb-3 max-h-64" />
                <div class="flex items-start gap-2 mb-2">
                    <span v-if="a.is_pinned" class="text-xs bg-gold/20 text-gold-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                        Pinned
                    </span>
                    <h2 class="text-base font-semibold text-gray-900 flex-1">{{ a.title }}</h2>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-line mb-3">{{ a.content }}</p>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                    <span>{{ a.author_name }}</span>
                    <span>&middot;</span>
                    <span>{{ formatDate(a.created_at) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
