// src/stores/auth.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { TblUser, TblMembersProfile } from '@/types/database.types'

export const useAuthStore = defineStore('auth', () => {

    // ── State ─────────────────────────────────────────────────
    const session = ref<Session | null>(null)
    const user = ref<TblUser | null>(null)
    const profile = ref<TblMembersProfile | null>(null)
    const resolved = ref(false)  // has the initial session check completed?
    const loading = ref(false)
    const error = ref<string | null>(null)

    // ── Getters ───────────────────────────────────────────────
    const isAuthenticated = computed(() => !!session.value)
    const isApproved = computed(() => profile.value?.status === 'approved')
    const isPending = computed(() => profile.value?.status === 'pending')
    const isAdmin = computed(() =>
        ['super_admin', 'admin', 'pastoral'].includes(user.value?.role_type ?? '')
    )
    const isLeader = computed(() =>
        ['network_leader', 'lpath_leader'].includes(user.value?.role_type ?? '')
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
        const [{ data: userData }, { data: profileData }] = await Promise.all([
            supabase.from('tbl_users').select('*').eq('id', userId).single(),
            supabase.from('tbl_members_profile').select('*').eq('user_id', userId).single()
        ])

        user.value = userData ?? null
        profile.value = profileData ?? null
    }

    async function register(payload: {
        email: string
        password: string
        firstName: string
        middleName?: string
        lastName: string
        satelliteChurchId: number
    }) {
        loading.value = true
        error.value = null

        try {
            // 1. Create Supabase Auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: payload.email,
                password: payload.password
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('Registration failed')

            const userId = authData.user.id

            // 2. Insert into tbl_users (default role = member, pending)
            const { error: userError } = await supabase.from('tbl_users').insert({
                id: userId,
                email: payload.email,
                first_name: payload.firstName,
                last_name: payload.lastName,
                role_id: 6, // member role
                role_type: 'member',
                is_active: 'P' // pending
            })

            if (userError) throw userError

            // 3. Insert into tbl_members_profile
            const { error: profileError } = await supabase.from('tbl_members_profile').insert({
                user_id: userId,
                email: payload.email,
                first_name: payload.firstName,
                middle_name: payload.middleName ?? null,
                last_name: payload.lastName,
                satellite_church_id: payload.satelliteChurchId,
                status: 'pending'
            })

            if (profileError) throw profileError

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

    async function logout() {
        await supabase.auth.signOut()
        clearState()
    }

    function clearState() {
        session.value = null
        user.value = null
        profile.value = null
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
        isAdmin,
        isLeader,
        roleType,
        // actions
        resolveSession,
        fetchUserData,
        register,
        login,
        logout
    }
})