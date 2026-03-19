import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Tables } from '@/types/database.types'

type AttendanceLog = Tables<'tbl_attendance_logs'>

export const useAttendanceStore = defineStore('attendance', () => {
    const logs = ref<AttendanceLog[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchMyLogs() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        loading.value = true
        error.value = null

        const { data, error: err } = await supabase
            .from('tbl_attendance_logs')
            .select('*')
            .eq('user_id', auth.session.user.id)
            .order('log_date', { ascending: false })

        if (err) {
            error.value = err.message
        } else {
            logs.value = data ?? []
        }
        loading.value = false
    }

    async function selfCheckIn(event: Tables<'tbl_events'>) {
        const auth = useAuthStore()
        if (!auth.session?.user) return { success: false, error: 'Not authenticated' }

        const userId = auth.session.user.id

        // Check for duplicate
        const { data: existing } = await supabase
            .from('tbl_attendance_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('event_id', event.id)
            .eq('log_date', new Date().toISOString().split('T')[0])
            .limit(1)

        if (existing && existing.length > 0) {
            return { success: false, error: 'Already checked in for this event today' }
        }

        const userName = `${auth.user?.first_name ?? ''} ${auth.user?.last_name ?? ''}`.trim()

        const { error: insertErr } = await supabase
            .from('tbl_attendance_logs')
            .insert({
                user_id: userId,
                event_id: event.id,
                event_title: event.event_title,
                input_method: 'self',
                log_date: new Date().toISOString().split('T')[0],
                logged_at: new Date().toISOString(),
                logged_by: userId,
                logged_by_name: userName,
                logged_location_id: event.satellite_church_id,
                logged_location_name: auth.profile?.satellite_church_name ?? null,
            })

        if (insertErr) {
            return { success: false, error: insertErr.message }
        }

        await fetchMyLogs()
        return { success: true }
    }

    return { logs, loading, error, fetchMyLogs, selfCheckIn }
})
