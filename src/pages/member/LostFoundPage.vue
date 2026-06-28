<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLostFoundStore, type LostFoundItem } from '@/stores/lostfound.store'
import { useAuthStore } from '@/stores/auth.store'

const store = useLostFoundStore()
const auth = useAuthStore()

const CATEGORIES = ['Electronics', 'Clothing', 'Accessories', 'Documents', 'Keys', 'Bag', 'Wallet', 'Other']

const tab = ref<'all' | 'lost' | 'found'>('all')
const search = ref('')

const showModal = ref(false)
const editing = ref<LostFoundItem | null>(null)
const saving = ref(false)
const formError = ref('')
const form = ref({
    type: 'lost' as 'lost' | 'found',
    title: '',
    description: '',
    category: '',
    location: '',
    item_date: '',
    contact_info: '',
})
const photoFile = ref<File | null>(null)
const photoPreview = ref<string | null>(null)

const myId = computed(() => auth.session?.user.id)

onMounted(() => store.fetchItems())

const filtered = computed(() => {
    let list = store.items
    if (tab.value !== 'all') list = list.filter((i) => i.type === tab.value)

    const q = search.value.trim().toLowerCase()
    if (q) {
        list = list.filter(
            (i) =>
                i.title.toLowerCase().includes(q) ||
                (i.description ?? '').toLowerCase().includes(q) ||
                (i.location ?? '').toLowerCase().includes(q) ||
                (i.category ?? '').toLowerCase().includes(q),
        )
    }
    return list
})

function onPhotoChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null
    photoFile.value = file
    photoPreview.value = file ? URL.createObjectURL(file) : null
}

function openCreate() {
    editing.value = null
    form.value = { type: 'lost', title: '', description: '', category: '', location: '', item_date: '', contact_info: '' }
    photoFile.value = null
    photoPreview.value = null
    formError.value = ''
    showModal.value = true
}

function openEdit(item: LostFoundItem) {
    editing.value = item
    form.value = {
        type: item.type,
        title: item.title,
        description: item.description ?? '',
        category: item.category ?? '',
        location: item.location ?? '',
        item_date: item.item_date ?? '',
        contact_info: item.contact_info ?? '',
    }
    photoFile.value = null
    photoPreview.value = item.photo_url
    formError.value = ''
    showModal.value = true
}

async function submit() {
    if (!form.value.title.trim()) {
        formError.value = 'Please give the item a title.'
        return
    }
    saving.value = true
    formError.value = ''
    const payload = {
        type: form.value.type,
        title: form.value.title.trim(),
        description: form.value.description.trim() || undefined,
        category: form.value.category || undefined,
        location: form.value.location.trim() || undefined,
        item_date: form.value.item_date || null,
        contact_info: form.value.contact_info.trim() || undefined,
    }
    const res = editing.value
        ? await store.updateItem(editing.value.id, payload, photoFile.value)
        : await store.createItem(payload, photoFile.value)
    saving.value = false
    if (res.success) showModal.value = false
    else formError.value = res.error ?? 'Something went wrong.'
}

async function markResolved(item: LostFoundItem) {
    await store.setStatus(item.id, 'resolved')
}

async function reopen(item: LostFoundItem) {
    await store.setStatus(item.id, 'open')
}

async function remove(item: LostFoundItem) {
    if (!confirm(`Delete "${item.title}"?`)) return
    await store.deleteItem(item.id)
}

function canManage(item: LostFoundItem) {
    return item.user_id === myId.value || auth.canAccessAdmin
}

function posterName(item: LostFoundItem) {
    if (item.user_id === myId.value) return 'You'
    if (item.poster) return `${item.poster.first_name ?? ''} ${item.poster.last_name ?? ''}`.trim() || 'A member'
    return 'A member'
}

function formatDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div>
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Lost &amp; Found</h1>
                <p class="text-sm text-gray-500 mt-1">Report what you lost or found — your reports are reviewed by a church admin.</p>
            </div>
            <button
                class="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openCreate"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Report Item
            </button>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-3 mb-5">
            <div class="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                    v-for="t in (['all', 'lost', 'found'] as const)"
                    :key="t"
                    class="px-3.5 py-1.5 text-sm font-medium rounded-md capitalize transition-colors"
                    :class="tab === t ? 'bg-navy text-white' : 'text-gray-500 hover:text-navy'"
                    @click="tab = t"
                >
                    {{ t }}
                </button>
            </div>
            <input
                v-model="search"
                type="text"
                placeholder="Search items..."
                class="flex-1 min-w-48 sm:max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-16 text-gray-400">
            <p class="text-sm">No items here yet.</p>
        </div>

        <!-- Grid -->
        <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
                v-for="item in filtered"
                :key="item.id"
                class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
            >
                <div class="relative h-40 bg-gray-100">
                    <img v-if="item.photo_url" :src="item.photo_url" :alt="item.title" class="w-full h-full object-cover" />
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M6 18.75h12a2.25 2.25 0 002.25-2.25V7.5A2.25 2.25 0 0018 5.25H6A2.25 2.25 0 003.75 7.5v9A2.25 2.25 0 006 18.75z" />
                        </svg>
                    </div>
                    <span
                        class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                        :class="item.type === 'lost' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'"
                    >
                        {{ item.type }}
                    </span>
                    <span
                        v-if="item.status !== 'open'"
                        class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-gray-800/80 text-white"
                    >
                        {{ item.status }}
                    </span>
                </div>

                <div class="p-4 flex flex-col flex-1">
                    <div class="flex items-start justify-between gap-2">
                        <h3 class="font-semibold text-gray-900 leading-tight">{{ item.title }}</h3>
                        <span v-if="item.category" class="shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {{ item.category }}
                        </span>
                    </div>
                    <p v-if="item.description" class="text-sm text-gray-500 mt-1 line-clamp-2">{{ item.description }}</p>

                    <div class="mt-3 space-y-1 text-xs text-gray-500">
                        <p v-if="item.location" class="flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                            {{ item.location }}
                        </p>
                        <p>{{ item.type === 'lost' ? 'Lost' : 'Found' }} {{ formatDate(item.item_date) }} · by {{ posterName(item) }}</p>
                        <p v-if="item.contact_info" class="text-gray-600">Contact: {{ item.contact_info }}</p>
                    </div>

                    <div v-if="canManage(item)" class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3 text-sm">
                        <button v-if="item.status === 'open'" class="text-emerald-600 hover:text-emerald-700 font-medium" @click="markResolved(item)">
                            Mark Resolved
                        </button>
                        <button v-else class="text-gray-500 hover:text-gray-700 font-medium" @click="reopen(item)">
                            Reopen
                        </button>
                        <button class="text-navy hover:text-navy-600 font-medium" @click="openEdit(item)">Edit</button>
                        <button class="text-red-400 hover:text-red-600 font-medium ml-auto" @click="remove(item)">Delete</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create / Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">{{ editing ? 'Edit Item' : 'Report an Item' }}</h3>

                    <form class="space-y-3" @submit.prevent="submit">
                        <!-- Type toggle -->
                        <div class="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                class="py-2 rounded-lg text-sm font-medium border transition-colors"
                                :class="form.type === 'lost' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500'"
                                @click="form.type = 'lost'"
                            >
                                I lost this
                            </button>
                            <button
                                type="button"
                                class="py-2 rounded-lg text-sm font-medium border transition-colors"
                                :class="form.type === 'found' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'"
                                @click="form.type = 'found'"
                            >
                                I found this
                            </button>
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Title</label>
                            <input v-model="form.title" type="text" placeholder="e.g. Black umbrella" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Description</label>
                            <textarea v-model="form.description" rows="2" placeholder="Any details that help identify it..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">Category</label>
                                <select v-model="form.category" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                    <option value="">—</option>
                                    <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-600 mb-1">{{ form.type === 'lost' ? 'Date lost' : 'Date found' }}</label>
                                <input v-model="form.item_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Location</label>
                            <input v-model="form.location" type="text" placeholder="Where was it lost / found?" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Contact info <span class="text-gray-400">(optional)</span></label>
                            <input v-model="form.contact_info" type="text" placeholder="Phone or how to reach you" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-gray-600 mb-1">Photo <span class="text-gray-400">(optional)</span></label>
                            <div class="flex items-center gap-3">
                                <div class="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    <img v-if="photoPreview" :src="photoPreview" class="w-full h-full object-cover" />
                                    <span v-else class="text-gray-300 text-xs">None</span>
                                </div>
                                <input type="file" accept="image/*" class="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm" @change="onPhotoChange" />
                            </div>
                        </div>

                        <p v-if="formError" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ formError }}</p>

                        <div class="flex justify-end gap-3 pt-1">
                            <button type="button" class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showModal = false">Cancel</button>
                            <button type="submit" :disabled="saving" class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50">
                                {{ saving ? 'Saving...' : editing ? 'Save Changes' : 'Post Item' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>
    </div>
</template>
