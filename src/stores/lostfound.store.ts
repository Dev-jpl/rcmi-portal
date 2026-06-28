import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'

export interface LostFoundItem {
    id: string
    user_id: string
    type: 'lost' | 'found'
    title: string
    description: string | null
    category: string | null
    location: string | null
    item_date: string | null
    photo_url: string | null
    contact_info: string | null
    status: 'open' | 'claimed' | 'resolved'
    satellite_church_id: number | null
    resolved_by: string | null
    resolved_at: string | null
    created_at: string
    updated_at: string
    // joined poster info (optional)
    poster?: { first_name: string | null; last_name: string | null } | null
}

export interface NewLostFoundItem {
    type: 'lost' | 'found'
    title: string
    description?: string
    category?: string
    location?: string
    item_date?: string | null
    contact_info?: string
}

// tbl_lost_found is not in the generated types yet, so we work untyped here.
const table = () => supabase.from('tbl_lost_found' as any)

export const useLostFoundStore = defineStore('lostfound', () => {
    const items = ref<LostFoundItem[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function fetchItems() {
        loading.value = true
        error.value = null

        const { data, error: err } = await table()
            .select('*')
            .order('created_at', { ascending: false })

        if (err) {
            error.value = err.message
            loading.value = false
            return
        }

        const rows = (data ?? []) as unknown as LostFoundItem[]

        // Attach poster names from profiles the viewer is allowed to read (RLS:
        // admins see their church; members only see their own — others show generic).
        const ids = [...new Set(rows.map((r) => r.user_id))]
        if (ids.length) {
            const { data: profiles } = await supabase
                .from('tbl_members_profile')
                .select('user_id, first_name, last_name')
                .in('user_id', ids)
            const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]))
            for (const r of rows) {
                const p = byId.get(r.user_id)
                r.poster = p ? { first_name: p.first_name, last_name: p.last_name } : null
            }
        }

        items.value = rows
        loading.value = false
    }

    async function uploadPhoto(file: File): Promise<string | null> {
        const auth = useAuthStore()
        const uid = auth.session?.user.id
        if (!uid) return null
        const ext = file.name.split('.').pop()
        const path = `lost-found/${uid}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true })
        if (upErr) {
            error.value = upErr.message
            return null
        }
        return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }

    async function createItem(payload: NewLostFoundItem, file?: File | null) {
        const auth = useAuthStore()
        loading.value = true
        error.value = null
        try {
            let photoUrl: string | null = null
            if (file) {
                photoUrl = await uploadPhoto(file)
                if (!photoUrl) throw new Error(error.value ?? 'Photo upload failed')
            }

            const { error: err } = await table().insert({
                user_id: auth.session?.user.id,
                type: payload.type,
                title: payload.title,
                description: payload.description ?? null,
                category: payload.category ?? null,
                location: payload.location ?? null,
                item_date: payload.item_date || null,
                contact_info: payload.contact_info ?? null,
                photo_url: photoUrl,
                status: 'open',
                satellite_church_id: auth.profile?.satellite_church_id ?? null,
            })
            if (err) throw err
            await fetchItems()
            return { success: true }
        } catch (e: any) {
            error.value = e.message ?? 'Failed to post item'
            return { success: false, error: error.value }
        } finally {
            loading.value = false
        }
    }

    async function updateItem(id: string, updates: Partial<NewLostFoundItem>, file?: File | null) {
        error.value = null
        try {
            const patch: Record<string, unknown> = {
                ...updates,
                item_date: updates.item_date || null,
                updated_at: new Date().toISOString(),
            }
            if (file) {
                const url = await uploadPhoto(file)
                if (!url) throw new Error(error.value ?? 'Photo upload failed')
                patch.photo_url = url
            }
            const { error: err } = await table().update(patch).eq('id', id)
            if (err) throw err
            await fetchItems()
            return { success: true }
        } catch (e: any) {
            error.value = e.message ?? 'Failed to update item'
            return { success: false, error: error.value }
        }
    }

    async function setStatus(id: string, status: 'open' | 'claimed' | 'resolved') {
        const auth = useAuthStore()
        const resolved = status === 'resolved' || status === 'claimed'
        const { error: err } = await table()
            .update({
                status,
                resolved_by: resolved ? auth.session?.user.id ?? null : null,
                resolved_at: resolved ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (err) return { success: false, error: err.message }
        await fetchItems()
        return { success: true }
    }

    async function deleteItem(id: string) {
        const { error: err } = await table().delete().eq('id', id)
        if (err) return { success: false, error: err.message }
        items.value = items.value.filter((i) => i.id !== id)
        return { success: true }
    }

    return {
        items,
        loading,
        error,
        fetchItems,
        uploadPhoto,
        createItem,
        updateItem,
        setStatus,
        deleteItem,
    }
})
