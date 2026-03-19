<script setup lang="ts">
const props = defineProps<{
    title: string
    description?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    eventType?: string | null
    image?: string | null
}>()

function formatDate(d: string | null | undefined) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(d: string | null | undefined) {
    if (!d) return ''
    return new Date(d).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

function addToCalendar() {
    const start = props.dateFrom ? new Date(props.dateFrom).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : ''
    const end = props.dateTo ? new Date(props.dateTo).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') : start
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(props.title)}&dates=${start}/${end}&details=${encodeURIComponent(props.description ?? '')}`
    window.open(url, '_blank')
}
</script>

<template>
    <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
        <div v-if="image" class="w-12 h-12 rounded-lg overflow-hidden shrink-0">
            <img :src="image" :alt="title" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-12 h-12 rounded-lg bg-navy/10 flex items-center justify-center text-navy text-sm font-bold shrink-0">
            {{ dateFrom ? new Date(dateFrom).getDate() : '—' }}
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">{{ title }}</p>
            <p class="text-xs text-gray-500">
                {{ formatDate(dateFrom) }}
                <span v-if="dateFrom"> {{ formatTime(dateFrom) }}</span>
                <span v-if="eventType"> &middot; {{ eventType }}</span>
            </p>
            <p v-if="description" class="text-xs text-gray-400 mt-0.5 line-clamp-2">{{ description }}</p>
        </div>
        <button
            v-if="dateFrom"
            class="shrink-0 text-xs text-navy hover:underline"
            @click="addToCalendar"
            title="Add to Google Calendar"
        >
            + Cal
        </button>
    </div>
</template>
