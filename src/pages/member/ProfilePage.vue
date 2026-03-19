<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useMemberStore } from '@/stores/member.store'
import { supabase } from '@/lib/supabase'

const auth = useAuthStore()
const member = useMemberStore()

const loading = ref(true)
const saving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const uploading = ref(false)

const form = ref({
    first_name: '',
    middle_name: '',
    last_name: '',
    ext_name: '',
    email: '',
    birth_date: '',
    satellite_church_id: null as number | null,
})

const churches = ref<{ id: number; church_name: string }[]>([])

onMounted(async () => {
    await Promise.all([
        member.fetchProfile(),
        fetchChurches(),
    ])
    populateForm()
    loading.value = false
})

watch(() => member.profile, populateForm)

function populateForm() {
    if (!member.profile) return
    form.value = {
        first_name: member.profile.first_name ?? '',
        middle_name: member.profile.middle_name ?? '',
        last_name: member.profile.last_name ?? '',
        ext_name: member.profile.ext_name ?? '',
        email: member.profile.email ?? '',
        birth_date: member.profile.birth_date ?? '',
        satellite_church_id: member.profile.satellite_church_id,
    }
}

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
}

async function handleSave() {
    saving.value = true
    message.value = null

    const result = await member.updateProfile({
        first_name: form.value.first_name || null,
        middle_name: form.value.middle_name || null,
        last_name: form.value.last_name || null,
        ext_name: form.value.ext_name || null,
        birth_date: form.value.birth_date || null,
        satellite_church_id: form.value.satellite_church_id,
    })

    if (result.success) {
        message.value = { type: 'success', text: 'Profile updated successfully.' }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Failed to update.' }
    }
    saving.value = false
}

async function handlePhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    uploading.value = true
    message.value = null

    const result = await member.uploadPhoto(file)
    if (result.success) {
        message.value = { type: 'success', text: 'Photo updated.' }
    } else {
        message.value = { type: 'error', text: result.error ?? 'Upload failed.' }
    }
    uploading.value = false
}

const photoUrl = ref<string | null>(null)
watch(() => member.profile?.profile_photo_url, (url) => {
    photoUrl.value = url ?? null
}, { immediate: true })
</script>

<template>
    <div class="max-w-2xl">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">My Profile</h1>

        <!-- Loading skeleton -->
        <div v-if="loading" class="space-y-4">
            <div v-for="i in 5" :key="i" class="h-12 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        <form v-else @submit.prevent="handleSave" class="space-y-6">
            <!-- Photo -->
            <div class="flex items-center gap-5">
                <div class="w-20 h-20 rounded-full bg-navy-100 flex items-center justify-center overflow-hidden shrink-0">
                    <img v-if="photoUrl" :src="photoUrl" alt="Profile" class="w-full h-full object-cover" />
                    <span v-else class="text-2xl font-bold text-navy">
                        {{ (member.profile?.first_name?.[0] ?? '') + (member.profile?.last_name?.[0] ?? '') }}
                    </span>
                </div>
                <div>
                    <label class="inline-block px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                        {{ uploading ? 'Uploading...' : 'Change Photo' }}
                        <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="handlePhoto" />
                    </label>
                    <p class="text-xs text-gray-400 mt-1">JPG or PNG, max 2MB</p>
                </div>
            </div>

            <!-- Name fields -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                        v-model="form.first_name"
                        type="text"
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                    <input
                        v-model="form.middle_name"
                        type="text"
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                        v-model="form.last_name"
                        type="text"
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                    />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Ext Name (Jr, Sr, III)</label>
                    <input
                        v-model="form.ext_name"
                        type="text"
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                    />
                </div>
            </div>

            <!-- Email (read-only) -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                    :value="form.email"
                    type="email"
                    disabled
                    class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                />
            </div>

            <!-- Birth date -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
                <input
                    v-model="form.birth_date"
                    type="date"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                />
            </div>

            <!-- Church -->
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Satellite Church</label>
                <select
                    v-model="form.satellite_church_id"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                >
                    <option :value="null" disabled>Select a church</option>
                    <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                </select>
            </div>

            <!-- Message -->
            <p
                v-if="message"
                class="text-sm rounded-lg px-3 py-2"
                :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
            >
                {{ message.text }}
            </p>

            <!-- Submit -->
            <button
                type="submit"
                :disabled="saving"
                class="px-6 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
                {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
        </form>
    </div>
</template>
