<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import { useMemberStore } from '@/stores/member.store'

const auth = useAuthStore()
const memberStore = useMemberStore()
const activeTab = ref<'available' | 'enrolled' | 'completed' | 'pending'>('available')
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
    { key: 'available' as const, label: 'Available' },
    { key: 'pending' as const, label: 'Pending' },
    { key: 'enrolled' as const, label: 'Enrolled' },
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

// Programs the member is NOT yet enrolled in (no active or pending enrollment)
const unenrolledPrograms = computed(() => {
    const enrolledProgramIds = new Set(
        memberStore.programs
            .filter((p: any) => (p.is_active === 'Y' && !p.date_ended) || p.approval_status === 'pending')
            .map((p: any) => p.program_id)
    )
    return availablePrograms.value.filter(p => !enrolledProgramIds.has(p.id))
})

const filteredPending = computed(() => {
    return memberStore.programs.filter((p: any) => p.approval_status === 'pending')
})

const filteredEnrolled = computed(() => {
    return memberStore.programs.filter((p: any) => p.is_active === 'Y' && !p.date_ended && p.approval_status !== 'pending' && p.approval_status !== 'rejected')
})

const filteredCompleted = computed(() => {
    return memberStore.programs.filter((p: any) => p.is_active === 'N' || p.date_ended)
})

async function handleEnroll(program: Program) {
    if (!auth.session?.user) return
    enrollingId.value = program.id
    message.value = null

    const now = new Date()
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const { error } = await supabase.from('tbl_program_involvements').insert({
        user_id: auth.session.user.id,
        program_id: program.id,
        program_type: program.type,
        date_started: localToday,
        is_active: 'Y',
        approval_status: 'pending',
    })

    if (error) {
        message.value = { type: 'error', text: error.message }
    } else {
        message.value = { type: 'success', text: `Enrollment submitted for ${program.type}! Waiting for Pastor's approval.` }
        activeTab.value = 'pending'
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

        <!-- Pending Tab -->
        <template v-else-if="activeTab === 'pending'">
            <div v-if="!filteredPending.length" class="text-center py-8 text-gray-400">
                No pending enrollments.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="prog in filteredPending"
                    :key="prog.id"
                    class="bg-white rounded-lg border border-amber-200 p-4"
                >
                    <div class="flex items-start justify-between mb-1">
                        <h3 class="text-sm font-medium text-gray-900">{{ getProgramName(prog) }}</h3>
                        <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending Approval</span>
                    </div>
                    <p v-if="getProgramDescription(prog)" class="text-xs text-gray-500 mt-1">{{ getProgramDescription(prog) }}</p>
                    <div class="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Submitted {{ formatDate(prog.created_at) }}
                        </span>
                        <span v-if="getDurationDays(prog)" class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {{ getDurationDays(prog) }} days duration
                        </span>
                    </div>
                    <p class="text-xs text-amber-600/80 mt-3 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        Awaiting Pastor's approval before enrollment begins.
                    </p>
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
                        <span class="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Approved</span>
                    </div>

                    <p v-if="getProgramDescription(prog)" class="text-xs text-gray-500 mb-3">{{ getProgramDescription(prog) }}</p>

                    <!-- Enrollment details -->
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                        <span class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Started {{ formatDate(prog.date_started) }}
                        </span>
                        <span v-if="getDurationDays(prog)" class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {{ getDurationDays(prog) }} days
                        </span>
                        <span v-if="prog.remarks" class="flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                            {{ prog.remarks }}
                        </span>
                    </div>

                    <!-- Progress bar for programs with duration -->
                    <div v-if="getDurationDays(prog)" class="mt-3">
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
