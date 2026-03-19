import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface Notification {
    id: string
    user_id: string
    title: string
    body: string | null
    type: string
    is_read: boolean
    link: string | null
    created_at: string
}

export const useNotificationStore = defineStore('notification', () => {
    const notifications = ref<Notification[]>([])
    const loading = ref(false)
    let channel: RealtimeChannel | null = null

    const unreadCount = computed(() => notifications.value.filter((n) => !n.is_read).length)

    async function fetchNotifications() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        loading.value = true
        const { data } = await supabase
            .from('tbl_notifications')
            .select('*')
            .eq('user_id', auth.session.user.id)
            .order('created_at', { ascending: false })
            .limit(50)

        notifications.value = data ?? []
        loading.value = false
    }

    async function markAsRead(id: string) {
        await supabase.from('tbl_notifications').update({ is_read: true }).eq('id', id)
        const n = notifications.value.find((x) => x.id === id)
        if (n) n.is_read = true
    }

    async function markAllRead() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        await supabase
            .from('tbl_notifications')
            .update({ is_read: true })
            .eq('user_id', auth.session.user.id)
            .eq('is_read', false)

        notifications.value.forEach((n) => (n.is_read = true))
    }

    function subscribe() {
        const auth = useAuthStore()
        if (!auth.session?.user || channel) return

        channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'tbl_notifications',
                    filter: `user_id=eq.${auth.session.user.id}`,
                },
                (payload) => {
                    notifications.value.unshift(payload.new as Notification)
                },
            )
            .subscribe()
    }

    function unsubscribe() {
        if (channel) {
            supabase.removeChannel(channel)
            channel = null
        }
    }

    return {
        notifications,
        loading,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllRead,
        subscribe,
        unsubscribe,
    }
})
