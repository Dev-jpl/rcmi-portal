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

    async function updateEvent(id: string, payload: TablesUpdate<'tbl_events'>) {
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

    async function deleteEvent(id: string) {
        const { error: err } = await supabase.from('tbl_events').delete().eq('id', id)
        if (err) return { success: false, error: err.message }
        await fetchEvents()
        return { success: true }
    }

    async function findOrCreateFromDefault(defaultEvent: Tables<'lib_default_events'>) {
        const auth = useAuthStore()
        const now = new Date()
        const today = now.toISOString().split('T')[0]

        // Look for existing instance today
        const { data: existing } = await supabase
            .from('tbl_events')
            .select('*')
            .eq('default_event_id', defaultEvent.id)
            .gte('duration_from', `${today}T00:00:00`)
            .lte('duration_from', `${today}T23:59:59`)
            .maybeSingle()

        if (existing) return { success: true, data: existing as Event }

        // Create new instance
        const startTime = defaultEvent.default_start_time || '09:00'
        const endTime = defaultEvent.default_end_time || '11:00'

        // Map DefaultEvent to Event payload
        const payload: TablesInsert<'tbl_events'> = {
            event_title: defaultEvent.event_title,
            event_type: defaultEvent.event_type,
            duration_from: `${today}T${startTime}:00`,
            duration_to: `${today}T${endTime}:00`,
            checkin_start_at: (defaultEvent as any).default_checkin_time 
                ? `${today}T${(defaultEvent as any).default_checkin_time}:00` 
                : `${today}T01:00:00`,
            is_active: true,
            allow_self_checkin: true,
            satellite_church_id: auth.profile?.satellite_church_id ?? null,
            default_event_id: defaultEvent.id,
        }

        const { data: created, error: err } = await supabase
            .from('tbl_events')
            .insert({
                ...payload,
                created_by: auth.session?.user.id ?? null,
                created_by_name: `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim(),
            })
            .select()
            .single()

        if (err) return { success: false, error: err.message }
        await fetchEvents()
        return { success: true, data: created as Event }
    }

    return { events, loading, error, fetchEvents, createEvent, updateEvent, toggleActive, deleteEvent, findOrCreateFromDefault }
})
