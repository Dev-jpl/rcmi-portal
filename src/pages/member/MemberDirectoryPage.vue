<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'

interface DirectoryMember {
    user_id: string
    first_name: string | null
    last_name: string | null
    profile_photo_url: string | null
    satellite_church_name: string | null
}

const auth = useAuthStore()
const members = ref<DirectoryMember[]>([])
const search = ref('')
const loading = ref(true)

async function fetchMembers() {
    loading.value = true
    const churchId = auth.profile?.satellite_church_id

    let query = supabase
        .from('tbl_members_profile')
        .select('user_id, first_name, last_name, profile_photo_url, satellite_church_name')
        .eq('status', 'approved')
        .order('first_name')

    if (churchId) {
        query = query.eq('satellite_church_id', churchId)
    }

    const { data } = await query
    members.value = data ?? []
    loading.value = false
}

const filtered = computed(() => {
    if (!search.value) return members.value
    const q = search.value.toLowerCase()
    return members.value.filter((m) => {
        const name = [m.first_name, m.last_name].filter(Boolean).join(' ').toLowerCase()
        return name.includes(q)
    })
})

function getInitials(m: DirectoryMember) {
    return [(m.first_name?.[0] ?? ''), (m.last_name?.[0] ?? '')].join('')
}

onMounted(fetchMembers)
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Member Directory</h1>

        <!-- Search -->
        <div class="mb-6">
            <input
                v-model="search"
                type="text"
                placeholder="Search members..."
                class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
        </div>

        <div v-if="loading" class="text-center py-8 text-gray-400">Loading directory...</div>

        <div v-else-if="filtered.length === 0" class="text-center py-12 text-gray-400">
            {{ search ? 'No members match your search.' : 'No members found.' }}
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <router-link
                v-for="(m, i) in filtered"
                :key="i"
                :to="{ name: 'member-profile-view', params: { userId: m.user_id } }"
                class="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-navy/20 hover:shadow-sm transition-all group"
            >
                <div v-if="m.profile_photo_url" class="w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden">
                    <img :src="m.profile_photo_url" :alt="m.first_name ?? ''" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-14 h-14 rounded-full mx-auto mb-2 bg-navy/10 flex items-center justify-center text-navy text-sm font-bold">
                    {{ getInitials(m) }}
                </div>
                <p class="text-sm font-medium text-gray-900 truncate group-hover:text-navy transition-colors">{{ m.first_name }} {{ m.last_name }}</p>
                <p v-if="m.satellite_church_name" class="text-xs text-gray-400 truncate mt-0.5">{{ m.satellite_church_name }}</p>
            </router-link>
        </div>

        <p v-if="filtered.length" class="text-xs text-gray-400 text-center mt-6">
            {{ filtered.length }} member{{ filtered.length !== 1 ? 's' : '' }}
        </p>
    </div>
</template>
