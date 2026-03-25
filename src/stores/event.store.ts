import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

type Event = Tables<'tbl_events'>

export const useEventStore = defineStore('event', () => {
    const events = ref<Event[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    function getChurchScope() {
        const auth = useAuthStore()
        if (auth.user?.role_type === 'super_admin') return null
        return auth.profile?.satellite_church_id ?? null
    }

    async function fetchEvents() {
        loading.value = true
        error.value = null

        let query = supabase
            .from('tbl_events')
            .select('*')
            .order('duration_from', { ascending: false })

        const churchScope = getChurchScope()
        if (churchScope) {
            query = query.or(`satellite_church_id.eq.${churchScope},satellite_church_id.is.null`)
        }

        const { data, error: err } = await query

        if (err) {
            error.value = err.message
        } else {
            events.value = data ?? []
        }
        loading.value = false
    }

    async function createEvent(payload: TablesInsert<'tbl_events'>) {
        const auth = useAuthStore()
        const { error: err } = await supabase.from('tbl_events').insert({
            ...payload,
            created_by: auth.session?.user.id ?? null,
            created_by_name: `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim(),
        })

        if (err) return { success: false, error: err.message }
        await fetchEvents()
        return { success: true }
    }

    async function updateEvent(id: number, payload: TablesUpdate<'tbl_events'>) {
        const { error: err } = await supabase
            .from('tbl_events')
            .update(payload)
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchEvents()
        return { success: true }
    }

    async function toggleActive(event: Event) {
        return updateEvent(event.id, { is_active: !event.is_active })
    }

    async function deleteEvent(id: number) {
        const { error: err } = await supabase.from('tbl_events').delete().eq('id', id)
        if (err) return { success: false, error: err.message }
        await fetchEvents()
        return { success: true }
    }

    return { events, loading, error, fetchEvents, createEvent, updateEvent, toggleActive, deleteEvent }
})
