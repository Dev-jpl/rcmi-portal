<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useMemberStore } from '@/stores/member.store'

const auth = useAuthStore()
const memberStore = useMemberStore()
const activeTab = ref<'available' | 'enrolled' | 'completed'>('available')
const loading = ref(true)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const enrollingId = ref<number | null>(null)

interface Program {
    id: number
    type: string
    description: string | null
    date_started: string | null
    duration_days: number | null
    is_active: boolean
}

const availablePrograms = ref<Program[]>([])

const tabs = [
    { key: 'available' as const, label: 'Available Programs' },
    { key: 'enrolled' as const, label: 'My Enrolled' },
    { key: 'completed' as const, label: 'Completed' },
]

onMounted(async () => {
    await Promise.all([fetchAvailablePrograms(), memberStore.fetchPrograms()])
    loading.value = false
})

async function fetchAvailablePrograms() {
    const { data } = await supabase
        .from('lib_programs')
        .select('*')
        .eq('is_active', true)
        .order('type')
    availablePrograms.value = (data ?? []) as Program[]
}

// Programs the member is NOT yet enrolled in (active enrollment)
const unenrolledPrograms = computed(() => {
    const enrolledProgramIds = new Set(
        memberStore.programs
            .filter((p: any) => p.is_active === 'Y' && !p.date_ended)
            .map((p: any) => p.program_id)
    )
    return availablePrograms.value.filter(p => !enrolledProgramIds.has(p.id))
})

const filteredEnrolled = computed(() => {
    return memberStore.programs.filter((p: any) => p.is_active === 'Y' && !p.date_ended)
})

const filteredCompleted = computed(() => {
    return memberStore.programs.filter((p: any) => p.is_active === 'N' || p.date_ended)
})

async function handleEnroll(program: Program) {
    if (!auth.session?.user) return
    enrollingId.value = program.id
    message.value = null

    const { error } = await supabase.from('tbl_program_involvements').insert({
        user_id: auth.session.user.id,
        program_id: program.id,
        program_type: program.type,
        date_started: new Date().toISOString().split('T')[0],
        is_active: 'Y',
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `You have enrolled in ${program.type}!` }
        await memberStore.fetchPrograms()
    }
    enrollingId.value = null
}

function getProgramName(p: any) {
    return p.lib_programs?.type ?? p.program_type ?? 'Untitled Program'
}

function getProgramDescription(p: any) {
    return p.lib_programs?.description ?? null
}

function getDurationDays(p: any): number | null {
    return p.lib_programs?.duration_days ?? null
}

function getElapsedDays(p: any): number {
    if (!p.date_started) return 0
    const start = new Date(p.date_started)
    const end = p.date_ended ? new Date(p.date_ended) : new Date()
    const diffMs = end.getTime() - start.getTime()
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

function progressPercent(p: any): number {
    const total = getDurationDays(p)
    if (!total || !p.date_started) return 0
    const elapsed = getElapsedDays(p)
    return Math.min(100, Math.round((elapsed / total) * 100))
}

function formatDuration(days: number): string {
    if (days >= 365) {
        const y = Math.floor(days / 365)
        const m = Math.floor((days % 365) / 30)
        return m > 0 ? `${y}y ${m}mo` : `${y}y`
    }
    if (days >= 30) {
        const m = Math.floor(days / 30)
        const d = days % 30
        return d > 0 ? `${m}mo ${d}d` : `${m}mo`
    }
    return `${days}d`
}

function formatDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
    <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Programs</h1>

        <!-- Tabs -->
        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-6">
            <button
                v-for="tab in tabs"
                :key="tab.key"
                class="px-2.5 py-1 text-[11px] font-medium rounded transition-all whitespace-nowrap"
                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                @click="activeTab = tab.key"
            >
                {{ tab.label }}
            </button>
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
        <div v-if="loading" class="text-center py-8 text-gray-400">Loading programs...</div>

        <!-- Available Programs Tab -->
        <template v-else-if="activeTab === 'available'">
            <div v-if="!unenrolledPrograms.length" class="text-center py-8 text-gray-400">
                No available programs to enroll in.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="prog in unenrolledPrograms"
                    :key="prog.id"
                    class="bg-white rounded-lg border border-gray-200 p-4"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <h3 class="text-sm font-medium text-gray-900">{{ prog.type }}</h3>
                            <p v-if="prog.description" class="text-xs text-gray-500 mt-1">{{ prog.description }}</p>
                            <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                <span v-if="prog.duration_days" class="flex items-center gap-1">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {{ prog.duration_days }} days
                                </span>
                                <span v-if="prog.date_started">Started {{ formatDate(prog.date_started) }}</span>
                            </div>
                        </div>
                        <button
                            :disabled="enrollingId === prog.id"
                            class="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors shrink-0"
                            @click="handleEnroll(prog)"
                        >
                            {{ enrollingId === prog.id ? 'Enrolling...' : 'Enroll' }}
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <!-- Enrolled Tab -->
        <template v-else-if="activeTab === 'enrolled'">
            <div v-if="!filteredEnrolled.length" class="text-center py-8 text-gray-400">
                You are not enrolled in any programs.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="prog in filteredEnrolled"
                    :key="prog.id"
                    class="bg-white rounded-lg border border-gray-200 p-4"
                >
                    <div class="flex items-start justify-between mb-1">
                        <h3 class="text-sm font-medium text-gray-900">{{ getProgramName(prog) }}</h3>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">{{ formatDate(prog.date_started) }}</span>
                    </div>

                    <p v-if="getProgramDescription(prog)" class="text-xs text-gray-500 mb-3">{{ getProgramDescription(prog) }}</p>

                    <!-- Progress bar for programs with duration -->
                    <div v-if="getDurationDays(prog)" class="mt-2">
                        <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{{ formatDuration(getElapsedDays(prog)) }} of {{ formatDuration(getDurationDays(prog)!) }}</span>
                            <span>{{ progressPercent(prog) }}%</span>
                        </div>
                        <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all"
                                :class="progressPercent(prog) >= 100 ? 'bg-green-500' : 'bg-navy'"
                                :style="{ width: progressPercent(prog) + '%' }"
                            />
                        </div>
                    </div>

                    <!-- Without duration — just show elapsed -->
                    <div v-else-if="prog.date_started" class="mt-2">
                        <p class="text-xs text-gray-500">{{ formatDuration(getElapsedDays(prog)) }} enrolled</p>
                    </div>
                </div>
            </div>
        </template>

        <!-- Completed Tab -->
        <template v-else>
            <div v-if="!filteredCompleted.length" class="text-center py-8 text-gray-400">
                No completed programs.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="prog in filteredCompleted"
                    :key="prog.id"
                    class="bg-white rounded-lg border border-gray-200 p-4"
                >
                    <div class="flex items-start justify-between mb-1">
                        <h3 class="text-sm font-medium text-gray-900">{{ getProgramName(prog) }}</h3>
                        <span class="text-xs text-gray-400 whitespace-nowrap ml-2">{{ formatDate(prog.date_started) }}</span>
                    </div>

                    <p v-if="getProgramDescription(prog)" class="text-xs text-gray-500 mb-3">{{ getProgramDescription(prog) }}</p>

                    <div class="mt-2 flex items-center justify-between">
                        <div class="flex items-center gap-1 text-xs text-green-600">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Completed {{ formatDate(prog.date_ended) }}</span>
                        </div>
                        <span v-if="prog.date_started" class="text-xs text-gray-400">
                            {{ formatDuration(getElapsedDays(prog)) }} total
                        </span>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
