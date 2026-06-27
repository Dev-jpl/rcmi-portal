// src/stores/auth.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import type { TblUser, TblMembersProfile } from '@/types/database.types'

export const useAuthStore = defineStore('auth', () => {

    // ── State ─────────────────────────────────────────────────
    const session = ref<Session | null>(null)
    const user = ref<TblUser | null>(null)
    const profile = ref<TblMembersProfile | null>(null)
    const resolved = ref(false)  // has the initial session check completed?
    const loading = ref(false)
    const error = ref<string | null>(null)

    // Leadership assignments (based on active records in leadership tables)
    const isPastor = ref(false)
    const isNetworkLeader = ref(false)
    const isLpathLeader = ref(false)
    const isMinistryHead = ref(false)
    const ministryHeadIds = ref<number[]>([])
    const myMinistries = ref<{ id: number; name: string; icon: string }[]>([])

    // ── Getters ───────────────────────────────────────────────
    const isAuthenticated = computed(() => !!session.value)
    const isApproved = computed(() => profile.value?.status === 'approved')
    const isPending = computed(() => profile.value?.status === 'pending')
    const isRejected = computed(() => profile.value?.status === 'rejected')
    const isAdmin = computed(() =>
        ['super_admin', 'admin'].includes(user.value?.role_type ?? '')
    )
    const hasLeadershipRole = computed(() =>
        isPastor.value || isNetworkLeader.value || isLpathLeader.value || isMinistryHead.value
    )
    const canAccessAdmin = computed(() =>
        isAdmin.value || hasLeadershipRole.value
    )
    const roleType = computed(() => user.value?.role_type ?? 'member')

    // ── Actions ───────────────────────────────────────────────

    let _resolvePromise: Promise<void> | null = null

    function resolveSession(): Promise<void> {
        if (_resolvePromise) return _resolvePromise

        _resolvePromise = (async () => {
            try {
                const { data } = await supabase.auth.getSession()
                session.value = data.session

                if (data.session?.user) {
                    await fetchUserData(data.session.user.id)
                }

                // Listen for auth state changes (login, logout, token refresh)
                supabase.auth.onAuthStateChange(async (_event, newSession) => {
                    session.value = newSession
                    if (newSession?.user) {
                        await fetchUserData(newSession.user.id)
                    } else {
                        clearState()
                    }
                })
            } catch (e) {
                // Supabase may be unreachable — continue as unauthenticated
                console.warn('Failed to resolve session:', e)
            } finally {
                resolved.value = true
            }
        })()

        return _resolvePromise
    }

    async function fetchUserData(userId: string) {
        const [
            { data: userData },
            { data: profileData },
            { data: pastoralData },
            { data: networkData },
            { data: lpathData },
            { data: ministryHeadData },
        ] = await Promise.all([
            supabase.from('tbl_users').select('*').eq('id', userId).single(),
            supabase.from('tbl_members_profile').select('*').eq('user_id', userId).single(),
            supabase.from('tbl_pastoral_members').select('id').eq('user_id', userId).eq('is_active', 'Y').limit(1),
            supabase.from('tbl_network_leaders').select('id').eq('user_id', userId).eq('is_active', 'Y').limit(1),
            supabase.from('tbl_lpath_leaders').select('id').eq('user_id', userId).eq('is_active', 'Y').limit(1),
            supabase.from('tbl_ministry_involvements').select('ministry_id, ministry_type, lib_ministries(icon)').eq('user_id', userId).eq('member_type', 'head').eq('is_active', 'Y'),
        ])

        user.value = userData ?? null
        profile.value = profileData ?? null
        isPastor.value = (pastoralData?.length ?? 0) > 0
        isNetworkLeader.value = (networkData?.length ?? 0) > 0
        isLpathLeader.value = (lpathData?.length ?? 0) > 0
        isMinistryHead.value = (ministryHeadData?.length ?? 0) > 0
        ministryHeadIds.value = (ministryHeadData ?? []).map((d: any) => d.ministry_id)
        myMinistries.value = (ministryHeadData ?? []).map((d: any) => ({
            id: d.ministry_id,
            name: d.ministry_type ?? 'My Ministry',
            icon: d.lib_ministries?.icon || 'ministries'
        }))
    }

    // Manually create the tbl_users + tbl_members_profile rows for a freshly
    // registered auth user. Previously handled by the handle_new_user DB trigger,
    // which proved unreliable — so we do it client-side instead. Requires an active
    // session: RLS only allows inserting rows where id/user_id = auth.uid().
    // Idempotent (ignoreDuplicates) so it's safe if the trigger ever also fires
    // or the call is retried.
    async function createMemberRecords(userId: string, payload: {
        email: string
        firstName: string
        middleName?: string
        lastName: string
        satelliteChurchId: number
        satelliteChurchName?: string
    }) {
        const { error: userError } = await supabase
            .from('tbl_users')
            .upsert(
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
        if (userError) throw userError

        const { error: profileError } = await supabase
            .from('tbl_members_profile')
            .upsert(
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
        if (profileError) throw profileError
    }

    async function register(payload: {
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
            // 1. Create the Supabase Auth user. Registration data is still passed as
            //    metadata (used by the email-confirmation backfill path), but the
            //    tbl_users / tbl_members_profile rows are now created manually below
            //    rather than relying on the handle_new_user trigger.
            const { data: authData, error: authError } = await supabase.auth.signUp({
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

            if (authError) throw authError
            if (!authData.user) throw new Error('Registration failed. Please try again.')

            // Supabase returns a fake success for existing emails (security)
            // Check if identities array is empty — means user already exists
            const identities = (authData.user as any).identities
            if (Array.isArray(identities) && identities.length === 0) {
                throw new Error('An account with this email has already been registered.')
            }

            // 2. Obtain a session. When GoTrue email confirmation is enabled, signUp
            //    returns no session — but the auto_confirm_email DB trigger (migration
            //    013) marks the account confirmed on insert, so we can sign in straight
            //    away to get one. If confirmation is disabled, signUp already returned a
            //    session and this sign-in is skipped.
            session.value = authData.session
            if (!session.value) {
                const { data: signInData } = await supabase.auth.signInWithPassword({
                    email: payload.email,
                    password: payload.password,
                })
                session.value = signInData.session
            }

            // 3. Create the app-level rows. Requires the session above so RLS
            //    (id/user_id = auth.uid()) permits the insert.
            if (session.value) {
                await createMemberRecords(authData.user.id, payload)
                await fetchUserData(authData.user.id)
            }

            return { success: true }
        } catch (err: any) {
            error.value = err.message ?? 'Registration failed'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

    async function login(email: string, password: string) {
        loading.value = true
        error.value = null

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) throw authError

            session.value = data.session
            await fetchUserData(data.user.id)

            return { success: true }
        } catch (err: any) {
            error.value = err.message ?? 'Login failed'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

    async function forgotPassword(email: string) {
        loading.value = true
        error.value = null

        try {
            const siteUrl = import.meta.env.VITE_APP_URL || window.location.origin
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${siteUrl}/reset-password`,
            })
            if (resetError) throw resetError
            return { success: true }
        } catch (err: any) {
            error.value = err.message ?? 'Failed to send reset email'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

    async function updatePassword(newPassword: string) {
        loading.value = true
        error.value = null

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })
            if (updateError) throw updateError
            return { success: true }
        } catch (err: any) {
            error.value = err.message ?? 'Failed to update password'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

    async function logout() {
        await supabase.auth.signOut()
        clearState()
    }

    function clearState() {
        session.value = null
        user.value = null
        profile.value = null
        isPastor.value = false
        isNetworkLeader.value = false
        isLpathLeader.value = false
        isMinistryHead.value = false
        ministryHeadIds.value = []
        myMinistries.value = []
    }

    return {
        // state
        session,
        user,
        profile,
        resolved,
        loading,
        error,
        // getters
        isAuthenticated,
        isApproved,
        isPending,
        isRejected,
        isAdmin,
        isPastor,
        isNetworkLeader,
        isLpathLeader,
        isMinistryHead,
        ministryHeadIds,
        myMinistries,
        hasLeadershipRole,
        canAccessAdmin,
        roleType,
        // actions
        resolveSession,
        fetchUserData,
        createMemberRecords,
        register,
        login,
        forgotPassword,
        updatePassword,
        logout
    }
})