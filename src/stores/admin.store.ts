import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Tables } from '@/types/database.types'

type MembersProfile = Tables<'tbl_members_profile'>
type TblUser = Tables<'tbl_users'>

export const useAdminStore = defineStore('admin', () => {
    const members = ref<MembersProfile[]>([])
    const users = ref<TblUser[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const isSuperAdmin = computed(() => {
        const auth = useAuthStore()
        return auth.user?.role_type === 'super_admin'
    })

    function getChurchScope() {
        const auth = useAuthStore()
        if (auth.user?.role_type === 'super_admin') return null
        return auth.profile?.satellite_church_id ?? null
    }

    async function fetchMembers(filters?: { status?: string; churchId?: number }) {
        loading.value = true
        error.value = null

        let query = supabase
            .from('tbl_members_profile')
            .select('*')
            .order('created_at', { ascending: false })

        const churchScope = filters?.churchId ?? getChurchScope()
        if (churchScope) {
            query = query.eq('satellite_church_id', churchScope)
        }
        if (filters?.status) {
            query = query.eq('status', filters.status)
        }

        const { data, error: err } = await query

        if (err) {
            error.value = err.message
        } else {
            members.value = data ?? []
        }
        loading.value = false
    }

    async function fetchUsers() {
        let query = supabase.from('tbl_users').select('*')
        const churchScope = getChurchScope()
        // tbl_users doesn't have church_id, so we join through members
        const { data } = await query
        users.value = data ?? []
    }

    const pendingMembers = computed(() =>
        members.value.filter((m) => m.status === 'pending'),
    )

    async function approveMember(profile: MembersProfile) {
        const auth = useAuthStore()
        const qrToken = crypto.randomUUID()

        const { error: err } = await supabase
            .from('tbl_members_profile')
            .update({
                status: 'approved',
                qr_token: qrToken,
                approved_by: auth.session?.user.id ?? null,
                approved_at: new Date().toISOString(),
            })
            .eq('id', profile.id)

        if (err) return { success: false, error: err.message }

        // Also activate the user record
        await supabase
            .from('tbl_users')
            .update({ is_active: 'Y' })
            .eq('id', profile.user_id)

        // Fire approval email (in-app notification is handled by the
        // on_member_profile_approved DB trigger). Failures don't block approval.
        if (profile.email) {
            supabase.functions
                .invoke('send-approval-email', {
                    body: { email: profile.email, firstName: profile.first_name },
                })
                .catch((e) => console.warn('send-approval-email failed:', e))
        }

        await fetchMembers()
        return { success: true }
    }

    async function rejectMember(profile: MembersProfile, reason: string) {
        const { error: err } = await supabase
            .from('tbl_members_profile')
            .update({
                status: 'rejected',
                rejected_reason: reason,
            })
            .eq('id', profile.id)

        if (err) return { success: false, error: err.message }

        await supabase
            .from('tbl_users')
            .update({ is_active: 'N' })
            .eq('id', profile.user_id)

        await fetchMembers()
        return { success: true }
    }

    async function fetchMemberById(userId: string) {
        const [{ data: profileData }, { data: userData }] = await Promise.all([
            supabase.from('tbl_members_profile').select('*').eq('user_id', userId).single(),
            supabase.from('tbl_users').select('*').eq('id', userId).single(),
        ])
        return { profile: profileData, user: userData }
    }

    async function fetchMemberAttendance(userId: string) {
        const { data } = await supabase
            .from('tbl_attendance_logs')
            .select('*')
            .eq('user_id', userId)
            .order('log_date', { ascending: false })
        return data ?? []
    }

    async function fetchMemberMinistries(userId: string) {
        const { data } = await supabase
            .from('tbl_ministry_involvements')
            .select('*')
            .eq('user_id', userId)
        return data ?? []
    }

    async function deleteMember(profile: MembersProfile) {
        // Delete profile record (cascade or manual cleanup)
        const { error: err } = await supabase
            .from('tbl_members_profile')
            .delete()
            .eq('id', profile.id)

        if (err) return { success: false, error: err.message }
        await fetchMembers()
        return { success: true }
    }

    return {
        members,
        users,
        loading,
        error,
        isSuperAdmin,
        pendingMembers,
        fetchMembers,
        fetchUsers,
        approveMember,
        rejectMember,
        deleteMember,
        fetchMemberById,
        fetchMemberAttendance,
        fetchMemberMinistries,
        getChurchScope,
    }
})
