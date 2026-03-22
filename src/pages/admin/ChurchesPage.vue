<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'
import ChurchFormModal from '@/components/churches/ChurchFormModal.vue'

type Church = Tables<'lib_satellite_churches'>

const churches = ref<Church[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

const modalOpen = ref(false)
const editingChurch = ref<Church | null>(null)

const search = ref('')

const filtered = computed(() => {
    const q = search.value.toLowerCase()
    if (!q) return churches.value
    return churches.value.filter(
        (c) =>
            c.church_name.toLowerCase().includes(q) ||
            c.municipality_name?.toLowerCase().includes(q) ||
            c.province_name?.toLowerCase().includes(q),
    )
})

onMounted(fetchChurches)

async function fetchChurches() {
    loading.value = true
    error.value = null
    const { data, error: err } = await supabase
        .from('lib_satellite_churches')
        .select('*')
        .order('church_name')
    if (err) {
        error.value = err.message
    } else {
        churches.value = data ?? []
    }
    loading.value = false
}

function openAdd() {
    editingChurch.value = null
    modalOpen.value = true
}

function openEdit(church: Church) {
    editingChurch.value = church
    modalOpen.value = true
}

async function handleSave(formData: TablesInsert<'lib_satellite_churches'> | TablesUpdate<'lib_satellite_churches'>) {
    saving.value = true
    error.value = null

    if (editingChurch.value) {
        const { error: err } = await supabase
            .from('lib_satellite_churches')
            .update(formData as TablesUpdate<'lib_satellite_churches'>)
            .eq('id', editingChurch.value.id)
        if (err) error.value = err.message
    } else {
        const { error: err } = await supabase
            .from('lib_satellite_churches')
            .insert(formData as TablesInsert<'lib_satellite_churches'>)
        if (err) error.value = err.message
    }

    saving.value = false
    if (!error.value) {
        modalOpen.value = false
        await fetchChurches()
    }
}

async function toggleActive(church: Church) {
    await supabase
        .from('lib_satellite_churches')
        .update({ is_active: !church.is_active })
        .eq('id', church.id)
    await fetchChurches()
}
</script>

<template>
    <div>
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Satellite Churches</h1>
                <p class="text-sm text-gray-500 mt-1">Manage church locations and geo data</p>
            </div>
            <button
                class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                @click="openAdd"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Church
            </button>
        </div>

        <!-- Search -->
        <div class="mb-4">
            <input
                v-model="search"
                type="text"
                placeholder="Search churches..."
                class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
            />
        </div>

        <!-- Error -->
        <p v-if="error" class="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4">{{ error }}</p>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-12 text-gray-400">Loading churches...</div>

        <!-- Empty -->
        <div v-else-if="!filtered.length" class="text-center py-12">
            <p class="text-gray-400">{{ search ? 'No churches match your search.' : 'No churches yet.' }}</p>
        </div>

        <!-- Table -->
        <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                            <th class="px-4 py-3">Church Name</th>
                            <th class="px-4 py-3 hidden md:table-cell">Location</th>
                            <th class="px-4 py-3 hidden lg:table-cell">Coordinates</th>
                            <th class="px-4 py-3 text-center">Status</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        <tr v-for="church in filtered" :key="church.id" class="hover:bg-gray-50/50">
                            <td class="px-4 py-3 font-medium text-gray-900">{{ church.church_name }}</td>
                            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">
                                <span v-if="church.municipality_name || church.province_name">
                                    {{ [church.barangay_name, church.municipality_name, church.province_name].filter(Boolean).join(', ') }}
                                </span>
                                <span v-else class="text-gray-300">No location set</span>
                            </td>
                            <td class="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                                <span v-if="church.latitude">
                                    {{ church.latitude?.toFixed(4) }}, {{ church.longitude?.toFixed(4) }}
                                </span>
                                <span v-else>—</span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <button
                                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors"
                                    :class="church.is_active
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                                    @click="toggleActive(church)"
                                >
                                    {{ church.is_active ? 'Active' : 'Inactive' }}
                                </button>
                            </td>
                            <td class="px-4 py-3 text-right">
                                <button
                                    class="text-navy hover:text-navy-600 text-sm font-medium"
                                    @click="openEdit(church)"
                                >
                                    Edit
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Modal -->
        <ChurchFormModal
            :open="modalOpen"
            :church="editingChurch"
            @close="modalOpen = false"
            @save="handleSave"
        />
    </div>
</template>
