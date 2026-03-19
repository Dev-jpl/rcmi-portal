<script setup lang="ts">
import { ref, watch } from 'vue'
import LocationPicker from './LocationPicker.vue'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

type Church = Tables<'lib_satellite_churches'>

const props = defineProps<{
    open: boolean
    church?: Church | null
}>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'save', data: TablesInsert<'lib_satellite_churches'> | TablesUpdate<'lib_satellite_churches'>): void
}>()

const form = ref(getDefaults())

function getDefaults() {
    return {
        church_name: '',
        is_active: true,
        latitude: null as number | null,
        longitude: null as number | null,
        country_name: null as string | null,
        country_code: null as string | null,
        region_name: null as string | null,
        region_code: null as string | null,
        province_name: null as string | null,
        province_code: null as string | null,
        municipality_name: null as string | null,
        municipality_code: null as string | null,
        barangay_name: null as string | null,
        barangay_code: null as string | null,
    }
}

watch(
    () => props.open,
    (isOpen) => {
        if (isOpen && props.church) {
            form.value = {
                church_name: props.church.church_name,
                is_active: props.church.is_active ?? true,
                latitude: props.church.latitude,
                longitude: props.church.longitude,
                country_name: props.church.country_name,
                country_code: props.church.country_code,
                region_name: props.church.region_name,
                region_code: props.church.region_code,
                province_name: props.church.province_name,
                province_code: props.church.province_code,
                municipality_name: props.church.municipality_name,
                municipality_code: props.church.municipality_code,
                barangay_name: props.church.barangay_name,
                barangay_code: props.church.barangay_code,
            }
        } else if (isOpen) {
            form.value = getDefaults()
        }
    },
)

function onLocationUpdate(result: {
    lat: number
    lng: number
    country?: string
    countryCode?: string
    region?: string
    province?: string
    municipality?: string
    barangay?: string
}) {
    form.value.latitude = result.lat
    form.value.longitude = result.lng
    form.value.country_name = result.country ?? null
    form.value.country_code = result.countryCode ?? null
    form.value.region_name = result.region ?? null
    form.value.province_name = result.province ?? null
    form.value.municipality_name = result.municipality ?? null
    form.value.barangay_name = result.barangay ?? null
}

function handleSave() {
    if (!form.value.church_name.trim()) return
    emit('save', { ...form.value })
}

const isEditing = ref(false)
watch(() => props.church, (c) => { isEditing.value = !!c })
</script>

<template>
    <Teleport to="body">
        <div
            v-if="open"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            @click.self="$emit('close')"
        >
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <!-- Header -->
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-heading font-bold text-navy">
                        {{ church ? 'Edit Church' : 'Add Church' }}
                    </h3>
                    <button
                        type="button"
                        class="text-gray-400 hover:text-gray-600 text-xl leading-none"
                        @click="$emit('close')"
                    >
                        &times;
                    </button>
                </div>

                <!-- Body -->
                <form class="px-6 py-5 space-y-5" @submit.prevent="handleSave">
                    <!-- Church name + active -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Church Name *</label>
                            <input
                                v-model="form.church_name"
                                type="text"
                                required
                                class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                                placeholder="e.g. RCMI Cubao"
                            />
                        </div>
                        <div class="flex items-end">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input
                                    v-model="form.is_active"
                                    type="checkbox"
                                    class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy"
                                />
                                <span class="text-sm text-gray-700">Active</span>
                            </label>
                        </div>
                    </div>

                    <!-- Map -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <LocationPicker
                            :latitude="form.latitude"
                            :longitude="form.longitude"
                            @update="onLocationUpdate"
                        />
                    </div>

                    <!-- Resolved geo fields (read-only display) -->
                    <div v-if="form.latitude" class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                            <span class="text-gray-400">Lat/Lng:</span>
                            <span class="ml-1 text-gray-700">{{ form.latitude?.toFixed(6) }}, {{ form.longitude?.toFixed(6) }}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Country:</span>
                            <span class="ml-1 text-gray-700">{{ form.country_name || '—' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Region:</span>
                            <span class="ml-1 text-gray-700">{{ form.region_name || '—' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Province:</span>
                            <span class="ml-1 text-gray-700">{{ form.province_name || '—' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Municipality:</span>
                            <span class="ml-1 text-gray-700">{{ form.municipality_name || '—' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-400">Barangay:</span>
                            <span class="ml-1 text-gray-700">{{ form.barangay_name || '—' }}</span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            class="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                            @click="$emit('close')"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-6 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
                        >
                            {{ church ? 'Update' : 'Create' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
