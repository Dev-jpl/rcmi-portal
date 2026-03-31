<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { ministryIcons } from '@/utils/ministryIcons'

const availableIcons = Object.keys(ministryIcons)

interface Ministry {
    id: number
    ministry_type: string
    description: string | null
    is_active: boolean
    icon: string
    memberCount?: number
}

const router = useRouter()
const ministries = ref<Ministry[]>([])
const loading = ref(true)
const search = ref('')
const showModal = ref(false)
const showDeleteModal = ref(false)
const deleteTarget = ref<Ministry | null>(null)
const editingId = ref<number | null>(null)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const saving = ref(false)
const deleting = ref(false)

const form = ref({
    ministry_type: '',
    description: '',
    is_active: true,
    icon: 'ministries',
})

onMounted(async () => {
    await fetchMinistries()
    loading.value = false
})

async function fetchMinistries() {
    const { data } = await supabase
        .from('lib_ministries')
        .select('*')
        .order('ministry_type')
    ministries.value = (data ?? []) as Ministry[]

    // Get member counts
    const { data: counts } = await supabase
        .from('tbl_ministry_involvements')
        .select('ministry_id')
        .eq('is_active', 'Y')

    if (counts) {
        const countMap = new Map<number, number>()
        for (const row of counts) {
            countMap.set(row.ministry_id, (countMap.get(row.ministry_id) ?? 0) + 1)
        }
        for (const m of ministries.value) {
            m.memberCount = countMap.get(m.id) ?? 0
        }
    }
}

const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return ministries.value
    return ministries.value.filter(m =>
        m.ministry_type.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    )
})

function openAdd() {
    editingId.value = null
    form.value = { ministry_type: '', description: '', is_active: true, icon: 'ministries' }
    showModal.value = true
}

function openEdit(m: Ministry) {
    editingId.value = m.id
    form.value = {
        ministry_type: m.ministry_type,
        description: m.description ?? '',
        is_active: m.is_active,
        icon: m.icon ?? 'ministries'
    }
    showModal.value = true
}

function openDelete(m: Ministry) {
    deleteTarget.value = m
    showDeleteModal.value = true
}

async function handleDelete() {
    if (!deleteTarget.value) return
    deleting.value = true

    // Delete involvements first, then the ministry
    await supabase.from('tbl_ministry_involvements').delete().eq('ministry_id', deleteTarget.value.id)
    await supabase.from('tbl_ministry_heads').delete().eq('ministry_id', deleteTarget.value.id)
    const { error } = await supabase.from('lib_ministries').delete().eq('id', deleteTarget.value.id)

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: 'Ministry deleted.' }
    }

    deleting.value = false
    showDeleteModal.value = false
    deleteTarget.value = null
    await fetchMinistries()
}

async function handleSave() {
    if (!form.value.ministry_type.trim()) return
    saving.value = true
    message.value = null

    if (editingId.value) {
        const { error } = await supabase
            .from('lib_ministries')
            .update({
                ministry_type: form.value.ministry_type.trim(),
                description: form.value.description.trim() || null,
                is_active: form.value.is_active,
                icon: form.value.icon,
            })
            .eq('id', editingId.value)
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Ministry updated.' }
        }
    } else {
        const { error } = await supabase.from('lib_ministries').insert({
            ministry_type: form.value.ministry_type.trim(),
            description: form.value.description.trim() || null,
            is_active: form.value.is_active,
            icon: form.value.icon,
        })
        if (error) {
            message.value = { type: 'error', text: error.message }
        } else {
            message.value = { type: 'success', text: 'Ministry created.' }
        }
    }

    saving.value = false
    showModal.value = false
    await fetchMinistries()
}

function goToDetail(m: Ministry) {
    router.push({ name: 'admin-ministry-detail', params: { id: m.id } })
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Ministries</h1>
                <p class="text-sm text-gray-500 mt-1">{{ filtered.length }} ministr{{ filtered.length !== 1 ? 'ies' : 'y' }}</p>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Ministry
            </button>
        </div>

        <!-- Search -->
        <div class="mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search ministries..."
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Message -->
        <p
            v-if="message"
            class="text-sm rounded-lg px-4 py-2 mb-4"
            :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
        >
            {{ message.text }}
        </p>

        <!-- Loading -->
        <div v-if="loading" class="space-y-3">
            <div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No ministries found.</div>

        <!-- Grid -->
        <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
                v-for="m in filtered"
                :key="m.id"
                class="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
                @click="goToDetail(m)"
            >
                <div class="flex items-start justify-between mb-3">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-navy to-navy-600 flex items-center justify-center shrink-0">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="ministryIcons[m.icon ?? 'ministries']"></svg>
                    </div>
                    <div class="flex items-center gap-2" @click.stop>
                        <span
                            class="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                            :class="m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                        >
                            {{ m.is_active ? 'Active' : 'Inactive' }}
                        </span>
                        <button class="p-1 text-gray-400 hover:text-navy rounded transition-colors" @click="openEdit(m)" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                        </button>
                        <button class="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" @click="openDelete(m)" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                        </button>
                    </div>
                </div>
                <h3 class="font-semibold text-gray-900 group-hover:text-navy transition-colors">{{ m.ministry_type }}</h3>
                <p v-if="m.description" class="text-xs text-gray-500 mt-1 line-clamp-2">{{ m.description }}</p>
                <div class="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {{ m.memberCount ?? 0 }} member{{ (m.memberCount ?? 0) !== 1 ? 's' : '' }}
                </div>
            </div>
        </div>

        <!-- Add/Edit Modal -->
        <Teleport to="body">
            <div
                v-if="showModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">
                        {{ editingId ? 'Edit' : 'Add' }} Ministry
                    </h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Ministry Name</label>
                            <input
                                v-model="form.ministry_type"
                                type="text"
                                placeholder="e.g. Worship Ministry"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                v-model="form.description"
                                rows="3"
                                placeholder="Short description of this ministry..."
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Icon</label>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    v-for="ico in availableIcons"
                                    :key="ico"
                                    type="button"
                                    class="w-10 h-10 rounded-lg flex items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-navy/30"
                                    :class="form.icon === ico ? 'border-navy bg-navy/5 text-navy' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'"
                                    @click="form.icon = ico"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="ministryIcons[ico]"></svg>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select
                                v-model="form.is_active"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                            >
                                <option :value="true">Active</option>
                                <option :value="false">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-6">
                        <button
                            class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                            @click="showModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            :disabled="!form.ministry_type.trim() || saving"
                            class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50"
                            @click="handleSave"
                        >
                            {{ saving ? 'Saving...' : editingId ? 'Update' : 'Create' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Confirmation Modal -->
        <Teleport to="body">
            <div
                v-if="showDeleteModal"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="showDeleteModal = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                    <h3 class="text-lg font-heading font-bold text-gray-900 mb-2">Delete Ministry</h3>
                    <p class="text-sm text-gray-500 mb-6">
                        Are you sure you want to delete <strong>{{ deleteTarget?.ministry_type }}</strong>? This will also remove all member enrollments in this ministry. This action cannot be undone.
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showDeleteModal = false">Cancel</button>
                        <button :disabled="deleting" class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50" @click="handleDelete">
                            {{ deleting ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
