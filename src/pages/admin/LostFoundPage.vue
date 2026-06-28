<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLostFoundStore, type LostFoundItem } from '@/stores/lostfound.store'

const store = useLostFoundStore()

const typeFilter = ref('')
const statusFilter = ref('')
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const busy = ref<string | null>(null)

onMounted(() => store.fetchItems())

const filtered = computed(() => {
    let list = store.items
    if (typeFilter.value) list = list.filter((i) => i.type === typeFilter.value)
    if (statusFilter.value) list = list.filter((i) => i.status === statusFilter.value)
    const q = search.value.trim().toLowerCase()
    if (q) {
        list = list.filter(
            (i) =>
                i.title.toLowerCase().includes(q) ||
                (i.location ?? '').toLowerCase().includes(q) ||
                (i.category ?? '').toLowerCase().includes(q),
        )
    }
    return list
})

const openCount = computed(() => store.items.filter((i) => i.status === 'open').length)

async function resolve(item: LostFoundItem) {
    busy.value = item.id
    const res = await store.setStatus(item.id, item.status === 'open' ? 'resolved' : 'open')
    busy.value = null
    message.value = res.success
        ? { type: 'success', text: 'Updated.' }
        : { type: 'error', text: res.error ?? 'Failed.' }
}

async function remove(item: LostFoundItem) {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    busy.value = item.id
    const res = await store.deleteItem(item.id)
    busy.value = null
    message.value = res.success
        ? { type: 'success', text: 'Item deleted.' }
        : { type: 'error', text: res.error ?? 'Failed.' }
}

function posterName(item: LostFoundItem) {
    if (item.poster) return `${item.poster.first_name ?? ''} ${item.poster.last_name ?? ''}`.trim() || '—'
    return '—'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Lost &amp; Found</h1>
                <p class="text-sm text-gray-500 mt-1">{{ filtered.length }} item{{ filtered.length !== 1 ? 's' : '' }} · {{ openCount }} open</p>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3 mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search title, location, category..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
            <select v-model="typeFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                <option value="">All Types</option>
                <option value="lost">Lost</option>
                <option value="found">Found</option>
            </select>
            <select v-model="statusFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="claimed">Claimed</option>
                <option value="resolved">Resolved</option>
            </select>
        </div>

        <p v-if="message" class="text-sm rounded-lg px-4 py-2 mb-4" :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
            {{ message.text }}
        </p>

        <div v-if="store.loading" class="space-y-3">
            <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No items found.</div>

        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Item</th>
                            <th class="px-4 py-3 hidden md:table-cell">Type</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Location</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Posted by</th>
                            <th class="px-4 py-3 hidden md:table-cell">Date</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="item in filtered" :key="item.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                        <img v-if="item.photo_url" :src="item.photo_url" class="w-full h-full object-cover" />
                                        <span v-else class="text-gray-300 text-[10px]">No img</span>
                                    </div>
                                    <div class="min-w-0">
                                        <p class="font-medium text-gray-900 truncate">{{ item.title }}</p>
                                        <p class="text-xs text-gray-400">{{ item.category ?? '—' }}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 hidden md:table-cell">
                                <span class="px-2 py-0.5 rounded-full text-xs font-medium capitalize" :class="item.type === 'lost' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
                                    {{ item.type }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ item.location ?? '—' }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ posterName(item) }}</td>
                            <td class="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{{ formatDate(item.item_date) }}</td>
                            <td class="px-4 py-3">
                                <span
                                    class="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                                    :class="{
                                        'bg-blue-100 text-blue-700': item.status === 'open',
                                        'bg-gray-100 text-gray-600': item.status === 'claimed',
                                        'bg-green-100 text-green-700': item.status === 'resolved',
                                    }"
                                >
                                    {{ item.status }}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                    :disabled="busy === item.id"
                                    class="text-sm font-medium mr-3"
                                    :class="item.status === 'open' ? 'text-emerald-600 hover:text-emerald-700' : 'text-gray-500 hover:text-gray-700'"
                                    @click="resolve(item)"
                                >
                                    {{ item.status === 'open' ? 'Resolve' : 'Reopen' }}
                                </button>
                                <button :disabled="busy === item.id" class="text-red-400 hover:text-red-600 text-sm font-medium" @click="remove(item)">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
