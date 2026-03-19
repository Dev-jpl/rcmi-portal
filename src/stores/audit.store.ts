import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'

export interface AuditEntry {
    id: string
    user_id: string
    user_name: string
    action: string
    entity_type: string
    entity_id: string | null
    details: string | null
    created_at: string
}

export const useAuditStore = defineStore('audit', () => {
    const entries = ref<AuditEntry[]>([])
    const loading = ref(false)
    const totalCount = ref(0)

    async function fetchEntries(filters?: { action?: string; entity_type?: string; limit?: number; offset?: number }) {
        loading.value = true
        const limit = filters?.limit ?? 50
        const offset = filters?.offset ?? 0

        let query = supabase
            .from('tbl_audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (filters?.action) query = query.eq('action', filters.action)
        if (filters?.entity_type) query = query.eq('entity_type', filters.entity_type)

        const { data, count } = await query
        entries.value = data ?? []
        totalCount.value = count ?? 0
        loading.value = false
    }

    async function logAction(action: string, entityType: string, entityId?: string, details?: string) {
        const auth = useAuthStore()
        if (!auth.session?.user) return

        const userName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Unknown'

        await supabase.from('tbl_audit_log').insert({
            user_id: auth.session.user.id,
            user_name: userName,
            action,
            entity_type: entityType,
            entity_id: entityId ?? null,
            details: details ?? null,
        })
    }

    return { entries, loading, totalCount, fetchEntries, logAction }
})
