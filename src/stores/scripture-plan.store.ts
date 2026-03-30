import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import { getBookByName, type BibleBook } from '@/lib/bible-books'

export interface ScripturePlan {
    id: string
    title: string
    description: string | null
    is_active: boolean
    created_by: string
    created_at: string
}

export interface ScripturePlanEntry {
    id: string
    plan_id: string
    reading_date: string
    book_name: string
    book_code: number
    chapter_start: number
    chapter_end: number
    notes: string | null
}

export const useScripturePlanStore = defineStore('scripture-plan', () => {
    const plans = ref<ScripturePlan[]>([])
    const entries = ref<ScripturePlanEntry[]>([])
    const loading = ref(false)

    async function fetchPlans() {
        loading.value = true
        const { data } = await supabase
            .from('tbl_scripture_plans')
            .select('*')
            .order('created_at', { ascending: false })

        plans.value = data ?? []
        loading.value = false
    }

    async function createPlan(title: string, description: string | null) {
        const auth = useAuthStore()
        if (!auth.session?.user) return { success: false, error: 'Not authenticated' }

        const { error: err } = await supabase.from('tbl_scripture_plans').insert({
            title,
            description,
            is_active: false,
            created_by: auth.session.user.id,
        })

        if (err) return { success: false, error: err.message }
        await fetchPlans()
        return { success: true }
    }

    async function updatePlan(id: string, updates: { title?: string; description?: string | null; is_active?: boolean }) {
        if (updates.is_active) {
            // Deactivate all other plans first
            await supabase.from('tbl_scripture_plans').update({ is_active: false }).neq('id', id)
        }

        const { error: err } = await supabase
            .from('tbl_scripture_plans')
            .update(updates)
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchPlans()
        return { success: true }
    }

    async function deletePlan(id: string) {
        // Delete entries first
        await supabase.from('tbl_scripture_plan_entries').delete().eq('plan_id', id)
        const { error: err } = await supabase.from('tbl_scripture_plans').delete().eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchPlans()
        return { success: true }
    }

    async function fetchEntries(planId: string) {
        const { data } = await supabase
            .from('tbl_scripture_plan_entries')
            .select('*')
            .eq('plan_id', planId)
            .order('reading_date', { ascending: true })

        entries.value = data ?? []
    }

    async function addEntry(entry: Omit<ScripturePlanEntry, 'id'>) {
        const { error: err } = await supabase.from('tbl_scripture_plan_entries').insert(entry)
        if (err) return { success: false, error: err.message }
        await fetchEntries(entry.plan_id)
        return { success: true }
    }

    async function updateEntry(id: string, planId: string, updates: Partial<ScripturePlanEntry>) {
        const { error: err } = await supabase
            .from('tbl_scripture_plan_entries')
            .update(updates)
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchEntries(planId)
        return { success: true }
    }

    async function deleteEntry(id: string, planId: string) {
        const { error: err } = await supabase
            .from('tbl_scripture_plan_entries')
            .delete()
            .eq('id', id)

        if (err) return { success: false, error: err.message }
        await fetchEntries(planId)
        return { success: true }
    }

    /** Bulk-generate entries: 1 chapter per day (or chaptersPerDay) starting from startDate */
    async function bulkGenerate(planId: string, book: BibleBook, startDate: string, chaptersPerDay: number = 1) {
        const totalChapters = book.chapters
        const entriesToInsert: Omit<ScripturePlanEntry, 'id'>[] = []
        let chapter = 1
        let dayOffset = 0

        while (chapter <= totalChapters) {
            const date = new Date(startDate)
            date.setDate(date.getDate() + dayOffset)
            const dateStr = date.toISOString().split('T')[0]

            const chapterEnd = Math.min(chapter + chaptersPerDay - 1, totalChapters)

            entriesToInsert.push({
                plan_id: planId,
                reading_date: dateStr,
                book_name: book.name,
                book_code: book.code,
                chapter_start: chapter,
                chapter_end: chapterEnd,
                notes: null,
            })

            chapter = chapterEnd + 1
            dayOffset++
        }

        const { error: err } = await supabase.from('tbl_scripture_plan_entries').insert(entriesToInsert)
        if (err) return { success: false, error: err.message }
        await fetchEntries(planId)
        return { success: true, count: entriesToInsert.length }
    }

    /** Get today's reading from the active plan */
    async function fetchTodayReading(): Promise<ScripturePlanEntry | null> {
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        const { data: activePlan } = await supabase
            .from('tbl_scripture_plans')
            .select('id, title')
            .eq('is_active', true)
            .maybeSingle()

        if (!activePlan) return null

        const { data: entry } = await supabase
            .from('tbl_scripture_plan_entries')
            .select('*')
            .eq('plan_id', activePlan.id)
            .eq('reading_date', today)
            .maybeSingle()

        return entry ?? null
    }

    return {
        plans,
        entries,
        loading,
        fetchPlans,
        createPlan,
        updatePlan,
        deletePlan,
        fetchEntries,
        addEntry,
        updateEntry,
        deleteEntry,
        bulkGenerate,
        fetchTodayReading,
    }
})
