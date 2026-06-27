<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notification.store'
import { useRouter } from 'vue-router'

const store = useNotificationStore()
const router = useRouter()
const open = ref(false)

function toggle() {
    open.value = !open.value
    // Opening the panel counts as "seeing" the notifications — clear the badge.
    if (open.value && store.unreadCount > 0) {
        store.markAllRead()
    }
}

function handleClick(n: { id: string; link: string | null }) {
    store.markAsRead(n.id)
    open.value = false
    if (n.link) router.push(n.link)
}

function formatTime(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
}

onMounted(() => {
    store.fetchNotifications()
    store.subscribe()
})

onUnmounted(() => {
    store.unsubscribe()
})
</script>

<template>
    <div class="relative">
        <button
            class="relative p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            @click="toggle"
            title="Notifications"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span
                v-if="store.unreadCount > 0"
                class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
                {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
            </span>
        </button>

        <!-- Dropdown -->
        <Teleport to="body">
            <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />
        </Teleport>
        <div
            v-if="open"
            class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden"
        >
            <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 class="text-sm font-semibold text-gray-900">Notifications</h3>
                <button
                    v-if="store.unreadCount > 0"
                    class="text-xs text-navy hover:underline"
                    @click="store.markAllRead()"
                >
                    Mark all read
                </button>
            </div>
            <div class="max-h-80 overflow-y-auto">
                <div v-if="store.notifications.length === 0" class="px-4 py-6 text-center text-sm text-gray-400">
                    No notifications yet
                </div>
                <button
                    v-for="n in store.notifications"
                    :key="n.id"
                    class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    :class="{ 'bg-navy/5': !n.is_read }"
                    @click="handleClick(n)"
                >
                    <div class="flex items-start gap-2">
                        <div
                            v-if="!n.is_read"
                            class="w-2 h-2 rounded-full bg-navy mt-1.5 shrink-0"
                        />
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-gray-900 truncate">{{ n.title }}</p>
                            <p v-if="n.body" class="text-xs text-gray-500 line-clamp-2 mt-0.5">{{ n.body }}</p>
                            <p class="text-xs text-gray-400 mt-1">{{ formatTime(n.created_at) }}</p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>
