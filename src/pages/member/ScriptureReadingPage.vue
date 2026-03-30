<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { getBookByName } from '@/lib/bible-books'

function stripStrongs(text: string): string {
    return text.replace(/<S>\d+<\/S>/g, '').replace(/\s{2,}/g, ' ').trim()
}
import type { ScripturePlanEntry } from '@/stores/scripture-plan.store'

const route = useRoute()
const entry = ref<ScripturePlanEntry | null>(null)
const planTitle = ref('')
const verses = ref<{ chapter: number; verse: number; text: string }[]>([])
const loading = ref(true)
const error = ref(false)

// Adjacent day entries for prev/next navigation
const prevEntry = ref<ScripturePlanEntry | null>(null)
const nextEntry = ref<ScripturePlanEntry | null>(null)

const readingRef = computed(() => {
    if (!entry.value) return ''
    const e = entry.value
    if (e.chapter_start === e.chapter_end) return `${e.book_name} ${e.chapter_start}`
    return `${e.book_name} ${e.chapter_start}-${e.chapter_end}`
})

const readingDate = computed(() => {
    if (!entry.value) return ''
    return new Date(entry.value.reading_date + 'T00:00:00').toLocaleDateString('en', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
})

const isToday = computed(() => {
    if (!entry.value) return false
    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return entry.value.reading_date === localToday
})

async function loadEntry(date?: string) {
    loading.value = true
    error.value = false
    verses.value = []

    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const targetDate = date ?? (route.query.date as string) ?? localToday

    // Get active plan
    const { data: activePlan } = await supabase
        .from('tbl_scripture_plans')
        .select('id, title')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

    if (!activePlan) {
        loading.value = false
        return
    }

    planTitle.value = activePlan.title

    // Get today's entry
    const { data: entryData } = await supabase
        .from('tbl_scripture_plan_entries')
        .select('*')
        .eq('plan_id', activePlan.id)
        .eq('reading_date', targetDate)
        .limit(1)
        .maybeSingle()

    if (!entryData) {
        loading.value = false
        return
    }

    entry.value = entryData

    // Fetch prev/next entries
    const [{ data: prev }, { data: next }] = await Promise.all([
        supabase
            .from('tbl_scripture_plan_entries')
            .select('*')
            .eq('plan_id', activePlan.id)
            .lt('reading_date', targetDate)
            .order('reading_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('tbl_scripture_plan_entries')
            .select('*')
            .eq('plan_id', activePlan.id)
            .gt('reading_date', targetDate)
            .order('reading_date', { ascending: true })
            .limit(1)
            .maybeSingle(),
    ])
    prevEntry.value = prev
    nextEntry.value = next

    // Fetch scripture text
    const book = getBookByName(entryData.book_name)
    if (!book) { error.value = true; loading.value = false; return }

    try {
        const allVerses: { chapter: number; verse: number; text: string }[] = []
        for (let ch = entryData.chapter_start; ch <= entryData.chapter_end; ch++) {
            const res = await fetch(`https://bolls.life/get-chapter/KJV/${book.code}/${ch}/`)
            if (res.ok) {
                const data = await res.json()
                for (const v of data) {
                    allVerses.push({ chapter: ch, verse: v.verse, text: stripStrongs(v.text) })
                }
            }
        }
        verses.value = allVerses
    } catch {
        error.value = true
    }

    loading.value = false
}

function navRef(e: ScripturePlanEntry) {
    if (e.chapter_start === e.chapter_end) return `${e.book_name} ${e.chapter_start}`
    return `${e.book_name} ${e.chapter_start}-${e.chapter_end}`
}

watch(() => route.query.date, (newDate) => {
    if (newDate) loadEntry(newDate as string)
})

onMounted(() => loadEntry())
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <div class="mb-6">
            <router-link :to="{ name: 'member-dashboard' }" class="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-navy transition-colors mb-3">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Hub
            </router-link>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <div>
                    <h1 class="text-2xl font-heading font-bold text-navy">Daily Scripture</h1>
                    <p v-if="planTitle" class="text-xs text-gray-400">{{ planTitle }}</p>
                </div>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div class="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin mx-auto mb-3" />
            <p class="text-sm text-gray-400">Loading scripture...</p>
        </div>

        <!-- No active plan -->
        <div v-else-if="!entry" class="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <svg class="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p class="text-gray-400 text-sm">No scripture reading scheduled for this day.</p>
        </div>

        <!-- Scripture content -->
        <template v-else>
            <!-- Date & Reference card -->
            <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200/60 p-6 mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <span v-if="isToday" class="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-full font-semibold">TODAY</span>
                    <p class="text-sm text-amber-700/70">{{ readingDate }}</p>
                </div>
                <h2 class="text-2xl font-heading font-bold text-amber-900">{{ readingRef }}</h2>
                <p v-if="entry.notes" class="text-sm text-amber-700/80 mt-2 italic">{{ entry.notes }}</p>
            </div>

            <!-- Prev/Next navigation -->
            <div class="flex items-center justify-between mb-4">
                <button
                    v-if="prevEntry"
                    class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors"
                    @click="loadEntry(prevEntry!.reading_date)"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    {{ navRef(prevEntry!) }}
                </button>
                <span v-else />
                <button
                    v-if="nextEntry"
                    class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-navy transition-colors"
                    @click="loadEntry(nextEntry!.reading_date)"
                >
                    {{ navRef(nextEntry!) }}
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                <span v-else />
            </div>

            <!-- Verses -->
            <div v-if="error" class="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
                <p class="text-sm text-red-600">Could not load scripture text. Please try again later.</p>
            </div>

            <div v-else class="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
                <div v-for="(v, i) in verses" :key="i" class="mb-1">
                    <span v-if="entry.chapter_start !== entry.chapter_end && (i === 0 || verses[i - 1].chapter !== v.chapter)" class="block text-xs font-bold text-navy/40 uppercase tracking-wider mt-4 mb-2 first:mt-0">
                        Chapter {{ v.chapter }}
                    </span>
                    <p class="text-[15px] text-gray-700 leading-relaxed inline">
                        <sup class="text-xs text-gray-400 mr-0.5">{{ v.verse }}</sup>{{ v.text }}
                    </p>
                </div>
            </div>
        </template>
    </div>
</template>
