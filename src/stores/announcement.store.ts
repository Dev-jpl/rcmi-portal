import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'

export interface Announcement {
    id: string
    title: string
    content: string
    author_id: string
    author_name: string
    is_pinned: boolean
    created_at: string
}

export const useAnnouncementStore = defineStore('announcement', () => {
    const announcements = ref<Announcement[]>([])
    const loading = ref(false)

    async function fetchAnnouncements() {
        loading.value = true
        const { data } = await supabase
            .from('tbl_announcements')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(50)

        announcements.value = data ?? []
        loading.value = false
    }

    async function createAnnouncement(title: string, content: string, isPinned = false) {
        const auth = useAuthStore()
        if (!auth.session?.user) return { success: false, error: 'Not authenticated' }

        const authorName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Admin'

        const { error: err } = await supabase.from('tbl_announcements').insert({
            title,
            content,
            author_id: auth.session.user.id,
            author_name: authorName,
            is_pinned: isPinned,
        })

        if (err) return { success: false, error: err.message }
        await fetchAnnouncements()
        return { success: true }
    }

    async function updateAnnouncement(id: string, updates: { title?: string; content?: string; is_pinned?: boolean }) {
        const { error: err } = await supabase
            .from('tbl_announcements')
            .update(updates)
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchAnnouncements()
        return { success: true }
    }

    async function deleteAnnouncement(id: string) {
        const { error: err } = await supabase
            .from('tbl_announcements')
            .delete()
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchAnnouncements()
        return { success: true }
    }

    return {
        announcements,
        loading,
        fetchAnnouncements,
        createAnnouncement,
        updateAnnouncement,
        deleteAnnouncement,
    }
})
