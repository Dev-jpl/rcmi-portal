import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Tables, TablesUpdate } from '@/types/database.types'

type MembersProfile = Tables<'tbl_members_profile'>
type LpathMember = Tables<'tbl_lpath_members'>
type ProgramInvolvement = Tables<'tbl_program_involvements'>

interface NetworkProfile {
    myRole: string | null
    pastor: { name: string } | null
    networkLeader: { name: string } | null
    lpathLeader: { name: string } | null
}

export const useMemberStore = defineStore('member', () => {
    const profile = ref<MembersProfile | null>(null)
    const network = ref<NetworkProfile>({ myRole: null, pastor: null, networkLeader: null, lpathLeader: null })
    const programs = ref<ProgramInvolvement[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchProfile() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        loading.value = true
        error.value = null

        const { data, error: err } = await supabase
            .from('tbl_members_profile')
            .select('*')
            .eq('user_id', auth.session.user.id)
            .single()

        if (err) {
            error.value = err.message
        } else {
            profile.value = data
        }
        loading.value = false
    }

    async function fetchNetworkProfile() {
        const auth = useAuthStore()
        if (!auth.session?.user) return
        const userId = auth.session.user.id

        // 1. Check if user is a Pastor
        if (auth.isPastor) {
            network.value = {
                myRole: 'Pastor',
                pastor: null,
                networkLeader: null,
                lpathLeader: null,
            }
            return
        }

        // 2. Check if user is a Network Leader
        if (auth.isNetworkLeader) {
            const { data: nlRecord } = await supabase
                .from('tbl_network_leaders')
                .select('pastor_id, pastor_name')
                .eq('user_id', userId)
                .eq('is_active', 'Y')
                .limit(1)
                .maybeSingle()

            let pastorName = nlRecord?.pastor_name ?? null
            if (!pastorName && nlRecord?.pastor_id) {
                const { data: p } = await supabase
                    .from('tbl_members_profile')
                    .select('first_name, last_name')
                    .eq('user_id', nlRecord.pastor_id)
                    .maybeSingle()
                if (p) pastorName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
            }

            network.value = {
                myRole: 'Network Leader',
                pastor: pastorName ? { name: pastorName } : null,
                networkLeader: null,
                lpathLeader: null,
            }
            return
        }

        // 3. Check if user is an L-Path Leader
        if (auth.isLpathLeader) {
            const { data: llRecord } = await supabase
                .from('tbl_lpath_leaders')
                .select('network_leader_id, network_leader_name')
                .eq('user_id', userId)
                .eq('is_active', 'Y')
                .limit(1)
                .maybeSingle()

            let networkLeaderName = (llRecord as any)?.network_leader_name ?? null
            let pastorName: string | null = null

            if (llRecord?.network_leader_id) {
                const { data: nl } = await supabase
                    .from('tbl_network_leaders')
                    .select('first_name, last_name, pastor_name')
                    .eq('id', llRecord.network_leader_id)
                    .maybeSingle()
                if (nl) {
                    if (!networkLeaderName) networkLeaderName = `${nl.first_name ?? ''} ${nl.last_name ?? ''}`.trim()
                    pastorName = nl.pastor_name ?? null
                }
            }

            network.value = {
                myRole: 'L-Path Leader',
                pastor: pastorName ? { name: pastorName } : null,
                networkLeader: networkLeaderName ? { name: networkLeaderName } : null,
                lpathLeader: null,
            }
            return
        }

        // 4. Regular member — look up from tbl_lpath_members
        let { data: lpathData } = await supabase
            .from('tbl_lpath_members')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', 'Y')
            .limit(1)
            .maybeSingle()

        if (!lpathData) {
            const { data: fallback } = await supabase
                .from('tbl_lpath_members')
                .select('*')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle()
            lpathData = fallback
        }

        if (!lpathData) return

        // Resolve L-Path leader name
        let lpathLeaderName = lpathData.lpath_leader_name ?? null
        if (!lpathLeaderName && lpathData.lpath_leader_id) {
            const { data: ll } = await supabase
                .from('tbl_lpath_leaders')
                .select('first_name, last_name')
                .eq('id', lpathData.lpath_leader_id)
                .maybeSingle()
            if (ll) lpathLeaderName = `${ll.first_name ?? ''} ${ll.last_name ?? ''}`.trim()
        }

        // Resolve Network leader name
        let networkLeaderName = lpathData.network_leader_name ?? null
        if (!networkLeaderName && lpathData.network_leader_id) {
            const { data: nl } = await supabase
                .from('tbl_network_leaders')
                .select('first_name, last_name')
                .eq('id', lpathData.network_leader_id)
                .maybeSingle()
            if (nl) networkLeaderName = `${nl.first_name ?? ''} ${nl.last_name ?? ''}`.trim()
        }

        // Resolve Pastor name
        let pastorName: string | null = null
        if (lpathData.network_leader_id) {
            const { data: netLeader } = await supabase
                .from('tbl_network_leaders')
                .select('pastor_name')
                .eq('id', lpathData.network_leader_id)
                .maybeSingle()
            pastorName = netLeader?.pastor_name ?? null
        }

        network.value = {
            myRole: 'Member',
            pastor: pastorName ? { name: pastorName } : null,
            networkLeader: networkLeaderName ? { name: networkLeaderName } : null,
            lpathLeader: lpathLeaderName ? { name: lpathLeaderName } : null,
        }
    }

    async function fetchPrograms() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        const { data } = await supabase
            .from('tbl_program_involvements')
            .select('*, lib_programs(type, description, duration_days)')
            .eq('user_id', auth.session.user.id)
            .order('date_started', { ascending: false })

        programs.value = data ?? []
    }

    async function updateProfile(updates: TablesUpdate<'tbl_members_profile'>) {
        const auth = useAuthStore()
        if (!auth.session?.user) return { success: false, error: 'Not authenticated' }

        const { error: err } = await supabase
            .from('tbl_members_profile')
            .update(updates)
            .eq('user_id', auth.session.user.id)

        if (err) return { success: false, error: err.message }

        await fetchProfile()
        // Also refresh auth store profile
        await auth.fetchUserData(auth.session.user.id)
        return { success: true }
    }

    async function uploadPhoto(file: File) {
        const auth = useAuthStore()
        if (!auth.session?.user) return { success: false, error: 'Not authenticated' }

        const ext = file.name.split('.').pop()
        const path = `profiles/${auth.session.user.id}.${ext}`

        const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true })

        if (uploadErr) return { success: false, error: uploadErr.message }

        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)

        return updateProfile({ profile_photo_url: urlData.publicUrl })
    }

    return {
        profile, network, programs, loading, error,
        fetchProfile, fetchNetworkProfile, fetchPrograms, updateProfile, uploadPhoto,
    }
})
