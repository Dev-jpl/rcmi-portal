import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Database, Tables } from '@/types/database.types'

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

    // user_id → role_type, derived from the loaded tbl_users rows. Lets the members
    // list show who is an admin and pre-fill the edit form's admin toggle.
    const roleByUserId = computed(() => {
        const map = new Map<string, string>()
        for (const u of users.value) {
            if (u.role_type) map.set(u.id, u.role_type)
        }
        return map
    })

    // Update a member's profile info. Admins may edit members in their own church
    // (RLS: "profile: admin update status"); the protect trigger lets admins through.
    async function updateMemberInfo(
        userId: string,
        updates: { first_name?: string | null; middle_name?: string | null; last_name?: string | null },
    ) {
        const { error: err } = await supabase
            .from('tbl_members_profile')
            .update(updates)
            .eq('user_id', userId)

        if (err) return { success: false, error: err.message }
        await fetchMembers()
        return { success: true }
    }

    // Grant or revoke church-admin access. Only super_admins can update tbl_users
    // (enforced by RLS), so this is gated to super_admin in the UI. role_id 2 = admin,
    // 6 = member (ref_roles seed order).
    async function setMemberRole(userId: string, role: 'admin' | 'member') {
        const { error: err } = await supabase
            .from('tbl_users')
            .update({ role_type: role, role_id: role === 'admin' ? 2 : 6 })
            .eq('id', userId)

        if (err) return { success: false, error: err.message }
        await fetchUsers()
        return { success: true }
    }

    // Admin creates a member account directly. The auth user is created on an
    // isolated Supabase client so the admin's own session is never replaced by the
    // new user's. The app rows are inserted as the new user (RLS pins them to a
    // pending member), then the admin's privileged session auto-approves them —
    // an admin adding someone is an implicit vouch.
    async function addMember(payload: {
        email: string
        password: string
        firstName: string
        middleName?: string
        lastName: string
        satelliteChurchId: number
        satelliteChurchName?: string
    }) {
        loading.value = true
        error.value = null

        try {
            const tempClient = createClient<Database>(
                import.meta.env.VITE_SUPABASE_URL as string,
                import.meta.env.VITE_SUPABASE_ANON_KEY as string,
                { auth: { persistSession: false, autoRefreshToken: false } },
            )

            const { data: authData, error: signUpErr } = await tempClient.auth.signUp({
                email: payload.email,
                password: payload.password,
                options: {
                    data: {
                        first_name: payload.firstName,
                        last_name: payload.lastName,
                        middle_name: payload.middleName ?? null,
                        satellite_church_id: payload.satelliteChurchId,
                        satellite_church_name: payload.satelliteChurchName ?? null,
                    },
                },
            })

            if (signUpErr) throw signUpErr
            if (!authData.user) throw new Error('Could not create the member account.')

            const identities = (authData.user as any).identities
            if (Array.isArray(identities) && identities.length === 0) {
                throw new Error('An account with this email already exists.')
            }

            // Ensure the temp client has a session to insert under. With email
            // confirmation disabled signUp returns one; otherwise sign in (the
            // account is auto-confirmed by the DB trigger).
            let memberSession = authData.session
            if (!memberSession) {
                const { data: signInData } = await tempClient.auth.signInWithPassword({
                    email: payload.email,
                    password: payload.password,
                })
                memberSession = signInData.session
            }
            if (!memberSession) {
                throw new Error('Could not establish a session for the new member.')
            }

            const userId = authData.user.id

            const { error: uErr } = await tempClient.from('tbl_users').upsert(
                {
                    id: userId,
                    email: payload.email,
                    first_name: payload.firstName,
                    middle_name: payload.middleName ?? null,
                    last_name: payload.lastName,
                    role_id: 6,
                    role_type: 'member',
                    is_active: 'P',
                },
                { onConflict: 'id', ignoreDuplicates: true },
            )
            if (uErr) throw uErr

            const { error: pErr } = await tempClient.from('tbl_members_profile').upsert(
                {
                    user_id: userId,
                    email: payload.email,
                    first_name: payload.firstName,
                    middle_name: payload.middleName ?? null,
                    last_name: payload.lastName,
                    satellite_church_id: payload.satelliteChurchId,
                    satellite_church_name: payload.satelliteChurchName ?? null,
                    status: 'pending',
                },
                { onConflict: 'user_id', ignoreDuplicates: true },
            )
            if (pErr) throw pErr

            await tempClient.auth.signOut()

            // Auto-approve using the admin's privileged session.
            const auth = useAuthStore()
            await supabase
                .from('tbl_members_profile')
                .update({
                    status: 'approved',
                    qr_token: crypto.randomUUID(),
                    approved_by: auth.session?.user.id ?? null,
                    approved_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
            await supabase.from('tbl_users').update({ is_active: 'Y' }).eq('id', userId)

            await fetchMembers()
            return { success: true }
        } catch (err: any) {
            error.value = err.message ?? 'Failed to add member'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

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

    // Rejecting a member removes the account entirely (auth user → tbl_users →
    // tbl_members_profile), same as Delete. There is no lingering 'rejected' row.
    async function rejectMember(profile: MembersProfile, _reason?: string) {
        return deleteMember(profile)
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

    // Deletes the whole account. The admin_delete_member RPC removes the auth user,
    // which cascades to tbl_users and tbl_members_profile (and user-owned content).
    async function deleteMember(profile: MembersProfile) {
        const { error: err } = await (supabase.rpc as any)('admin_delete_member', {
            target_user_id: profile.user_id,
        })

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
        roleByUserId,
        fetchMembers,
        fetchUsers,
        addMember,
        updateMemberInfo,
        setMemberRole,
        approveMember,
        rejectMember,
        deleteMember,
        fetchMemberById,
        fetchMemberAttendance,
        fetchMemberMinistries,
        getChurchScope,
    }
})
