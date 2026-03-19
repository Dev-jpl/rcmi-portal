<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMemberStore } from '@/stores/member.store'

const memberStore = useMemberStore()
const activeTab = ref<'active' | 'enrolled' | 'completed'>('active')

const tabs = [
    { key: 'active' as const, label: 'Active Programs' },
    { key: 'enrolled' as const, label: 'Enrolled' },
    { key: 'completed' as const, label: 'Completed' },
]

const filtered = computed(() => {
    return memberStore.programs.filter((p) => {
        if (activeTab.value === 'completed') return p.status === 'completed'
        if (activeTab.value === 'enrolled') return p.status === 'enrolled' || p.status === 'in_progress'
        return p.status === 'active' || !p.status
    })
})

function formatDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function progressPercent(p: Record<string, unknown>): number {
    const progress = Number(p.progress ?? 0)
    return Math.min(100, Math.max(0, progress))
}

onMounted(() => {
    memberStore.fetchPrograms()
})
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Programs</h1>

        <!-- Tabs -->
        <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- List -->
        <div v-if="memberStore.loading" class="text-center py-8 text-gray-400">Loading programs…</div>

        <div v-else-if="filtered.length === 0" class="text-center py-8 text-gray-400">
            No programs in this category.
        </div>

        <div v-else class="space-y-3">
            <div
                v-for="prog in filtered"
                :key="prog.id"
                class="bg-white rounded-xl border border-gray-200 p-4"
            >
                <div class="flex items-start justify-between mb-1">
                    <h3 class="text-sm font-medium text-gray-900">{{ prog.program_name ?? 'Untitled Program' }}</h3>
                    <span class="text-xs text-gray-400 whitespace-nowrap ml-2">{{ formatDate(prog.date_started) }}</span>
                </div>

                <p v-if="prog.description" class="text-xs text-gray-500 mb-3">{{ prog.description }}</p>

                <!-- Progress bar for enrolled -->
                <div v-if="activeTab === 'enrolled'" class="mt-2">
                    <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{{ progressPercent(prog) }}%</span>
                    </div>
                    <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            class="h-full bg-navy rounded-full transition-all"
                            :style="{ width: progressPercent(prog) + '%' }"
                        />
                    </div>
                </div>

                <!-- Completed badge -->
                <div v-if="activeTab === 'completed'" class="mt-2 flex items-center gap-1 text-xs text-green-600">
                    <span>✓</span>
                    <span>Completed {{ formatDate(prog.date_completed) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
