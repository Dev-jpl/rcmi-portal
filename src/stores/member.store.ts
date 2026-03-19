import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { Tables, TablesUpdate } from '@/types/database.types'

type MembersProfile = Tables<'tbl_members_profile'>
type LpathMember = Tables<'tbl_lpath_members'>
type ProgramInvolvement = Tables<'tbl_program_involvements'>

interface NetworkProfile {
    pastor: { name: string } | null
    networkLeader: { name: string } | null
    lpathLeader: { name: string } | null
}

export const useMemberStore = defineStore('member', () => {
    const profile = ref<MembersProfile | null>(null)
    const network = ref<NetworkProfile>({ pastor: null, networkLeader: null, lpathLeader: null })
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

        // Find lpath membership to get leader chain
        const { data: lpathData } = await supabase
            .from('tbl_lpath_members')
            .select('*')
            .eq('user_id', auth.session.user.id)
            .eq('is_active', 'Y')
            .limit(1)
            .maybeSingle()

        if (lpathData) {
            network.value = {
                lpathLeader: lpathData.lpath_leader_name
                    ? { name: lpathData.lpath_leader_name }
                    : null,
                networkLeader: lpathData.network_leader_name
                    ? { name: lpathData.network_leader_name }
                    : null,
                pastor: null,
            }

            // Get pastor from network leader record
            if (lpathData.network_leader_id) {
                const { data: netLeader } = await supabase
                    .from('tbl_network_leaders')
                    .select('pastor_name')
                    .eq('id', lpathData.network_leader_id)
                    .maybeSingle()

                if (netLeader?.pastor_name) {
                    network.value.pastor = { name: netLeader.pastor_name }
                }
            }
        }
    }

    async function fetchPrograms() {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        const { data } = await supabase
            .from('tbl_program_involvements')
            .select('*')
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
