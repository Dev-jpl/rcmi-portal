<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useScripturePlanStore, type ScripturePlan, type ScripturePlanEntry } from '@/stores/scripture-plan.store'
import { BIBLE_BOOKS, getBookByName } from '@/lib/bible-books'

const route = useRoute()
const router = useRouter()
const store = useScripturePlanStore()
const planId = route.params.id as string

const plan = ref<ScripturePlan | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Bulk generate state
const showBulkModal = ref(false)
const bulkForm = ref({
    bookName: 'Genesis',
    startDate: new Date().toISOString().split('T')[0],
    chaptersPerDay: 1,
})
const bulkGenerating = ref(false)

// Single entry modal
const showEntryModal = ref(false)
const editingEntry = ref<ScripturePlanEntry | null>(null)
const entryForm = ref({
    reading_date: '',
    book_name: 'Genesis',
    chapter_start: 1,
    chapter_end: 1,
    notes: '',
})
const entrySaving = ref(false)

// Delete entry
const showDeleteModal = ref(false)
const deleteTarget = ref<ScripturePlanEntry | null>(null)
const entryDeleting = ref(false)

// View mode
const viewMode = ref<'list' | 'calendar'>('calendar')
const filterMonth = ref(new Date().toISOString().slice(0, 7)) // YYYY-MM

const selectedBook = computed(() => getBookByName(entryForm.value.book_name))
const bulkBook = computed(() => getBookByName(bulkForm.value.bookName))
const bulkDaysNeeded = computed(() => {
    if (!bulkBook.value) return 0
    return Math.ceil(bulkBook.value.chapters / bulkForm.value.chaptersPerDay)
})
const bulkEndDate = computed(() => {
    if (!bulkDaysNeeded.value) return ''
    const d = new Date(bulkForm.value.startDate)
    d.setDate(d.getDate() + bulkDaysNeeded.value - 1)
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
})

const filteredEntries = computed(() => {
    if (!filterMonth.value) return store.entries
    return store.entries.filter((e) => e.reading_date.startsWith(filterMonth.value))
})

// Calendar grid
const calendarDays = computed(() => {
    if (!filterMonth.value) return []
    const [year, month] = filterMonth.value.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startPad = firstDay.getDay() // 0=Sun

    const days: { date: string; day: number; entry: ScripturePlanEntry | null; isCurrentMonth: boolean }[] = []

    // Padding days
    for (let i = 0; i < startPad; i++) {
        days.push({ date: '', day: 0, entry: null, isCurrentMonth: false })
    }

    // Actual days
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const entry = store.entries.find((e) => e.reading_date === dateStr) ?? null
        days.push({ date: dateStr, day: d, entry, isCurrentMonth: true })
    }

    return days
})

const isToday = (dateStr: string) => {
    const now = new Date()
    return dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function openBulk() {
    bulkForm.value = {
        bookName: 'Genesis',
        startDate: getNextAvailableDate(),
        chaptersPerDay: 1,
    }
    showBulkModal.value = true
}

function getNextAvailableDate(): string {
    if (store.entries.length === 0) return new Date().toISOString().split('T')[0]
    const lastEntry = store.entries[store.entries.length - 1]
    const d = new Date(lastEntry.reading_date)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
}

async function handleBulkGenerate() {
    const book = bulkBook.value
    if (!book) return

    bulkGenerating.value = true
    error.value = null

    const result = await store.bulkGenerate(planId, book, bulkForm.value.startDate, bulkForm.value.chaptersPerDay)

    if (result.success) {
        showBulkModal.value = false
    } else {
        error.value = result.error ?? 'Failed to generate entries.'
    }
    bulkGenerating.value = false
}

function openAddEntry(date?: string) {
    editingEntry.value = null
    entryForm.value = {
        reading_date: date ?? getNextAvailableDate(),
        book_name: 'Genesis',
        chapter_start: 1,
        chapter_end: 1,
        notes: '',
    }
    showEntryModal.value = true
}

function openEditEntry(e: ScripturePlanEntry) {
    editingEntry.value = e
    entryForm.value = {
        reading_date: e.reading_date,
        book_name: e.book_name,
        chapter_start: e.chapter_start,
        chapter_end: e.chapter_end,
        notes: e.notes ?? '',
    }
    showEntryModal.value = true
}

function openDeleteEntry(e: ScripturePlanEntry) {
    deleteTarget.value = e
    showDeleteModal.value = true
}

async function handleSaveEntry() {
    entrySaving.value = true
    error.value = null

    const book = getBookByName(entryForm.value.book_name)
    if (!book) { entrySaving.value = false; return }

    const payload = {
        plan_id: planId,
        reading_date: entryForm.value.reading_date,
        book_name: entryForm.value.book_name,
        book_code: book.code,
        chapter_start: entryForm.value.chapter_start,
        chapter_end: entryForm.value.chapter_end,
        notes: entryForm.value.notes || null,
    }

    let result
    if (editingEntry.value) {
        result = await store.updateEntry(editingEntry.value.id, planId, payload)
    } else {
        result = await store.addEntry(payload)
    }

    if (result.success) {
        showEntryModal.value = false
    } else {
        error.value = result.error ?? 'Failed to save entry.'
    }
    entrySaving.value = false
}

async function handleDeleteEntry() {
    if (!deleteTarget.value) return
    entryDeleting.value = true
    await store.deleteEntry(deleteTarget.value.id, planId)
    showDeleteModal.value = false
    deleteTarget.value = null
    entryDeleting.value = false
}

function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatRef(e: ScripturePlanEntry) {
    if (e.chapter_start === e.chapter_end) return `${e.book_name} ${e.chapter_start}`
    return `${e.book_name} ${e.chapter_start}-${e.chapter_end}`
}

function prevMonth() {
    const [y, m] = filterMonth.value.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    filterMonth.value = d.toISOString().slice(0, 7)
}

function nextMonth() {
    const [y, m] = filterMonth.value.split('-').map(Number)
    const d = new Date(y, m, 1)
    filterMonth.value = d.toISOString().slice(0, 7)
}

function monthLabel(ym: string) {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

onMounted(async () => {
    await store.fetchPlans()
    plan.value = store.plans.find((p) => p.id === planId) ?? null
    if (!plan.value) {
        router.replace({ name: 'admin-scripture-plans' })
        return
    }
    await store.fetchEntries(planId)
    loading.value = false
})
</script>

<template>
    <div>
        <!-- Header -->
        <div class="flex items-center gap-3 mb-6">
            <button
                class="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-navy hover:border-navy transition-colors"
                @click="router.push({ name: 'admin-scripture-plans' })"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <div class="flex-1">
                <h1 class="text-2xl font-heading font-bold text-navy">{{ plan?.title ?? 'Loading...' }}</h1>
                <p v-if="plan?.description" class="text-sm text-gray-500 mt-0.5">{{ plan.description }}</p>
            </div>
        </div>

        <div v-if="loading" class="text-center py-12 text-gray-400">Loading plan...</div>

        <template v-else>
            <!-- Controls -->
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <div class="flex gap-2">
                    <button
                        class="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                        @click="openBulk"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Add Book
                    </button>
                    <button
                        class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        @click="openAddEntry()"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Entry
                    </button>
                </div>

                <span class="flex-1" />

                <!-- View toggle -->
                <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5">
                    <button
                        class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                        :class="viewMode === 'list' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                        @click="viewMode = 'list'"
                    >
                        List
                    </button>
                    <button
                        class="px-3 py-1.5 text-xs font-medium rounded transition-colors"
                        :class="viewMode === 'calendar' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                        @click="viewMode = 'calendar'"
                    >
                        Calendar
                    </button>
                </div>
            </div>

            <!-- Month Nav -->
            <div class="flex items-center justify-between mb-4">
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" @click="prevMonth">
                    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 class="text-sm font-semibold text-gray-900">{{ monthLabel(filterMonth) }}</h2>
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" @click="nextMonth">
                    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>

            <p class="text-xs text-gray-400 mb-4">{{ store.entries.length }} total entries &middot; {{ filteredEntries.length }} this month</p>

            <!-- Calendar View -->
            <div v-if="viewMode === 'calendar'" class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="day" class="px-2 py-2 text-xs font-medium text-gray-500 text-center">
                        {{ day }}
                    </div>
                </div>
                <div class="grid grid-cols-7">
                    <div
                        v-for="(cell, i) in calendarDays"
                        :key="i"
                        class="min-h-[80px] border-b border-r border-gray-100 p-1.5"
                        :class="{
                            'bg-gray-50/50': !cell.isCurrentMonth,
                            'bg-navy/5': isToday(cell.date),
                            'cursor-pointer hover:bg-gray-50': cell.isCurrentMonth && !cell.entry,
                        }"
                        @click="cell.isCurrentMonth && !cell.entry ? openAddEntry(cell.date) : cell.entry ? openEditEntry(cell.entry) : null"
                    >
                        <p v-if="cell.isCurrentMonth" class="text-xs font-medium mb-0.5" :class="isToday(cell.date) ? 'text-navy font-bold' : 'text-gray-400'">
                            {{ cell.day }}
                        </p>
                        <div v-if="cell.entry" class="bg-navy/10 text-navy rounded px-1 py-0.5">
                            <p class="text-[10px] font-medium leading-tight truncate">{{ formatRef(cell.entry) }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- List View -->
            <div v-else>
                <div v-if="filteredEntries.length === 0" class="text-center py-12 text-gray-400">
                    No entries for this month. Use "Add Book" to bulk-generate readings.
                </div>

                <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs text-gray-500 font-medium">Date</th>
                                <th class="px-4 py-3 text-left text-xs text-gray-500 font-medium">Reading</th>
                                <th class="px-4 py-3 text-left text-xs text-gray-500 font-medium hidden sm:table-cell">Notes</th>
                                <th class="px-4 py-3 text-right text-xs text-gray-500 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr
                                v-for="e in filteredEntries"
                                :key="e.id"
                                class="hover:bg-gray-50/50"
                                :class="{ 'bg-navy/[0.03]': isToday(e.reading_date) }"
                            >
                                <td class="px-4 py-3">
                                    <p class="text-sm text-gray-900">{{ formatDate(e.reading_date) }}</p>
                                    <span v-if="isToday(e.reading_date)" class="text-[10px] bg-navy/10 text-navy px-1.5 py-0.5 rounded-full font-medium">Today</span>
                                </td>
                                <td class="px-4 py-3">
                                    <p class="text-sm font-medium text-gray-900">{{ formatRef(e) }}</p>
                                </td>
                                <td class="px-4 py-3 hidden sm:table-cell">
                                    <p class="text-xs text-gray-500 line-clamp-1">{{ e.notes ?? '—' }}</p>
                                </td>
                                <td class="px-4 py-3 text-right" @click.stop>
                                    <button class="text-sm text-navy hover:underline mr-2" @click="openEditEntry(e)">Edit</button>
                                    <button class="text-sm text-red-500 hover:underline" @click="openDeleteEntry(e)">Delete</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Bulk Generate Modal -->
        <Teleport to="body">
            <div
                v-if="showBulkModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showBulkModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">Add Book to Plan</h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="showBulkModal = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleBulkGenerate">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Book *</label>
                            <select
                                v-model="bulkForm.bookName"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <optgroup label="Old Testament">
                                    <option v-for="b in BIBLE_BOOKS.filter(b => b.testament === 'OT')" :key="b.code" :value="b.name">
                                        {{ b.name }} ({{ b.chapters }} chapters)
                                    </option>
                                </optgroup>
                                <optgroup label="New Testament">
                                    <option v-for="b in BIBLE_BOOKS.filter(b => b.testament === 'NT')" :key="b.code" :value="b.name">
                                        {{ b.name }} ({{ b.chapters }} chapters)
                                    </option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                                <input
                                    v-model="bulkForm.startDate"
                                    type="date"
                                    required
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Chapters/Day</label>
                                <input
                                    v-model.number="bulkForm.chaptersPerDay"
                                    type="number"
                                    min="1"
                                    max="10"
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                        </div>

                        <div v-if="bulkBook" class="bg-navy/5 rounded-lg p-3">
                            <p class="text-sm text-navy font-medium">{{ bulkBook.name }}</p>
                            <p class="text-xs text-gray-500 mt-1">
                                {{ bulkBook.chapters }} chapters &rarr; {{ bulkDaysNeeded }} days
                                <span v-if="bulkEndDate"> &middot; Ends {{ bulkEndDate }}</span>
                            </p>
                        </div>

                        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>

                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" class="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showBulkModal = false">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="bulkGenerating"
                                class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ bulkGenerating ? 'Generating...' : `Generate ${bulkDaysNeeded} Entries` }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- Entry Add/Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showEntryModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showEntryModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">{{ editingEntry ? 'Edit Entry' : 'Add Entry' }}</h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="showEntryModal = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleSaveEntry">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                            <input
                                v-model="entryForm.reading_date"
                                type="date"
                                required
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Book *</label>
                            <select
                                v-model="entryForm.book_name"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <optgroup label="Old Testament">
                                    <option v-for="b in BIBLE_BOOKS.filter(b => b.testament === 'OT')" :key="b.code" :value="b.name">{{ b.name }}</option>
                                </optgroup>
                                <optgroup label="New Testament">
                                    <option v-for="b in BIBLE_BOOKS.filter(b => b.testament === 'NT')" :key="b.code" :value="b.name">{{ b.name }}</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Chapter Start *</label>
                                <input
                                    v-model.number="entryForm.chapter_start"
                                    type="number"
                                    min="1"
                                    :max="selectedBook?.chapters ?? 150"
                                    required
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Chapter End *</label>
                                <input
                                    v-model.number="entryForm.chapter_end"
                                    type="number"
                                    :min="entryForm.chapter_start"
                                    :max="selectedBook?.chapters ?? 150"
                                    required
                                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                                v-model="entryForm.notes"
                                rows="2"
                                placeholder="Optional reflection prompt or note..."
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>

                        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>

                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" class="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showEntryModal = false">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="entrySaving"
                                class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ entrySaving ? 'Saving...' : (editingEntry ? 'Update' : 'Add') }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- Delete Entry Confirmation -->
        <Teleport to="body">
            <div
                v-if="showDeleteModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showDeleteModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-heading font-bold text-gray-900">Delete Entry</h3>
                    </div>
                    <p class="text-sm text-gray-600 mb-5">
                        Remove the reading for <strong>{{ deleteTarget ? formatRef(deleteTarget) : '' }}</strong> on {{ deleteTarget ? formatDate(deleteTarget.reading_date) : '' }}?
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showDeleteModal = false">
                            Cancel
                        </button>
                        <button
                            :disabled="entryDeleting"
                            class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            @click="handleDeleteEntry"
                        >
                            {{ entryDeleting ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
