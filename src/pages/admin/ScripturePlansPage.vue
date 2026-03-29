<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useScripturePlanStore, type ScripturePlan } from '@/stores/scripture-plan.store'

const router = useRouter()
const store = useScripturePlanStore()
const modalOpen = ref(false)
const editing = ref<ScripturePlan | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const showDeleteModal = ref(false)
const deleteTarget = ref<ScripturePlan | null>(null)
const deleting = ref(false)

const form = ref({ title: '', description: '' })

function openAdd() {
    editing.value = null
    form.value = { title: '', description: '' }
    modalOpen.value = true
}

function openEdit(p: ScripturePlan) {
    editing.value = p
    form.value = { title: p.title, description: p.description ?? '' }
    modalOpen.value = true
}

function openDelete(p: ScripturePlan) {
    deleteTarget.value = p
    showDeleteModal.value = true
}

async function handleSave() {
    if (!form.value.title.trim()) return
    saving.value = true
    error.value = null

    let result
    if (editing.value) {
        result = await store.updatePlan(editing.value.id, {
            title: form.value.title,
            description: form.value.description || null,
        })
    } else {
        result = await store.createPlan(form.value.title, form.value.description || null)
    }

    if (result.success) {
        modalOpen.value = false
    } else {
        error.value = result.error ?? 'Failed to save.'
    }
    saving.value = false
}

async function handleDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    await store.deletePlan(deleteTarget.value.id)
    showDeleteModal.value = false
    deleteTarget.value = null
    deleting.value = false
}

async function toggleActive(p: ScripturePlan) {
    await store.updatePlan(p.id, { is_active: !p.is_active })
}

function viewPlan(p: ScripturePlan) {
    router.push({ name: 'admin-scripture-plan-detail', params: { id: p.id } })
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(() => store.fetchPlans())
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Scripture Reading Plans</h1>
                <p class="text-sm text-gray-500 mt-1">Set up daily Bible reading schedules for the church</p>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Plan
            </button>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <!-- Empty -->
        <div v-else-if="store.plans.length === 0" class="text-center py-12 text-gray-400">
            No reading plans yet. Create one to get started.
        </div>

        <!-- Plans List -->
        <div v-else class="space-y-3">
            <div
                v-for="p in store.plans"
                :key="p.id"
                class="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-4 cursor-pointer hover:border-gray-300 transition-colors"
                :class="{ 'border-green-300 ring-1 ring-green-200': p.is_active }"
                @click="viewPlan(p)"
            >
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span v-if="p.is_active" class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                            Active
                        </span>
                        <h3 class="text-sm font-semibold text-gray-900 truncate">{{ p.title }}</h3>
                    </div>
                    <p v-if="p.description" class="text-xs text-gray-500 line-clamp-2 mb-1">{{ p.description }}</p>
                    <p class="text-xs text-gray-400">Created {{ formatDate(p.created_at) }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0" @click.stop>
                    <button
                        class="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        :class="p.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                        @click="toggleActive(p)"
                    >
                        {{ p.is_active ? 'Active' : 'Set Active' }}
                    </button>
                    <button class="text-sm text-navy hover:underline" @click="openEdit(p)">Edit</button>
                    <button class="text-sm text-red-500 hover:underline" @click="openDelete(p)">Delete</button>
                </div>
            </div>
        </div>

        <!-- Create/Edit Modal -->
        <Teleport to="body">
            <div
                v-if="modalOpen"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                @click.self="modalOpen = false"
            >
                <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h3 class="text-lg font-heading font-bold text-navy">
                            {{ editing ? 'Edit Plan' : 'New Reading Plan' }}
                        </h3>
                        <button class="text-gray-400 hover:text-gray-600 text-xl" @click="modalOpen = false">&times;</button>
                    </div>

                    <form class="px-6 py-5 space-y-4" @submit.prevent="handleSave">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                            <input
                                v-model="form.title"
                                type="text"
                                required
                                placeholder="e.g., April-June 2026 Reading Plan"
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                v-model="form.description"
                                rows="3"
                                placeholder="Optional description or notes about this plan..."
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
                            />
                        </div>

                        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ error }}</p>

                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" class="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="modalOpen = false">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                :disabled="saving"
                                class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
                            >
                                {{ saving ? 'Saving...' : (editing ? 'Update' : 'Create') }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Teleport>

        <!-- Delete Confirmation -->
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
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-heading font-bold text-gray-900">Delete Plan</h3>
                    </div>
                    <p class="text-sm text-gray-600 mb-5">
                        Are you sure you want to delete <strong>"{{ deleteTarget?.title }}"</strong>? All reading entries will be removed. This cannot be undone.
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50" @click="showDeleteModal = false">
                            Cancel
                        </button>
                        <button
                            :disabled="deleting"
                            class="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            @click="handleDelete"
                        >
                            {{ deleting ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
