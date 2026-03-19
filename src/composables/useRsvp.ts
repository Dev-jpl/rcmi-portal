import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

export interface Rsvp {
    id: string
    event_id: number
    user_id: string
    status: 'going' | 'maybe' | 'not_going'
    created_at: string
}

export function useRsvp() {
    const rsvps = ref<Map<number, Rsvp>>(new Map())
    const rsvpCounts = ref<Map<number, { going: number; maybe: number }>>(new Map())
    const loading = ref(false)

    async function fetchRsvps(eventIds: number[]) {
        if (!eventIds.length) return
        const auth = useAuthStore()

        const { data } = await supabase
            .from('tbl_event_rsvps')
            .select('*')
            .in('event_id', eventIds)

        const userMap = new Map<number, Rsvp>()
        const countMap = new Map<number, { going: number; maybe: number }>()

        for (const id of eventIds) {
            countMap.set(id, { going: 0, maybe: 0 })
        }

        for (const r of data ?? []) {
            const counts = countMap.get(r.event_id) ?? { going: 0, maybe: 0 }
            if (r.status === 'going') counts.going++
            else if (r.status === 'maybe') counts.maybe++
            countMap.set(r.event_id, counts)

            if (r.user_id === auth.session?.user?.id) {
                userMap.set(r.event_id, r as Rsvp)
            }
        }

        rsvps.value = userMap
        rsvpCounts.value = countMap
    }

    async function setRsvp(eventId: number, status: 'going' | 'maybe' | 'not_going') {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        const existing = rsvps.value.get(eventId)

        if (existing) {
            if (existing.status === status) {
                // Toggle off — remove RSVP
                await supabase.from('tbl_event_rsvps').delete().eq('id', existing.id)
                rsvps.value.delete(eventId)
            } else {
                await supabase.from('tbl_event_rsvps').update({ status }).eq('id', existing.id)
                existing.status = status
            }
        } else {
            const { data } = await supabase
                .from('tbl_event_rsvps')
                .insert({
                    event_id: eventId,
                    user_id: auth.session.user.id,
                    status,
                })
                .select()
                .single()

            if (data) rsvps.value.set(eventId, data as Rsvp)
        }

        // Refresh counts
        await fetchRsvps([...rsvpCounts.value.keys()])
    }

    return { rsvps, rsvpCounts, loading, fetchRsvps, setRsvp }
}
