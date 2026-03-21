<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

interface NodeData {
    name: string
    role: 'Pastor' | 'Network Leader' | 'L-Path Leader' | 'Member'
    active?: boolean
    email?: string
}

defineProps<{ data: NodeData }>()

const roleConfig = {
    'Pastor': { bg: 'bg-navy/10', text: 'text-navy', badge: 'bg-navy text-white', avatar: 'bg-navy text-white' },
    'Network Leader': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-600 text-white', avatar: 'bg-blue-100 text-blue-700' },
    'L-Path Leader': { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-600 text-white', avatar: 'bg-emerald-100 text-emerald-700' },
    'Member': { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-500 text-white', avatar: 'bg-amber-100 text-amber-700' },
}

function initials(name: string) {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
    <div class="relative bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 min-w-[160px] max-w-[200px]">
        <Handle type="target" :position="Position.Top" class="!bg-gray-300 !w-2 !h-2 !border-0" />

        <div class="flex items-center gap-2.5">
            <!-- Avatar -->
            <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                :class="roleConfig[data.role].avatar"
            >
                {{ initials(data.name) }}
            </div>
            <div class="min-w-0">
                <p class="text-xs font-semibold text-gray-900 truncate leading-tight">{{ data.name }}</p>
                <span
                    class="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                    :class="roleConfig[data.role].badge"
                >
                    {{ data.role }}
                </span>
            </div>
            <!-- Active dot -->
            <div
                v-if="data.active !== undefined"
                class="w-2 h-2 rounded-full shrink-0 ml-auto"
                :class="data.active ? 'bg-green-400' : 'bg-gray-300'"
                :title="data.active ? 'Active' : 'Inactive'"
            />
        </div>

        <Handle type="source" :position="Position.Bottom" class="!bg-gray-300 !w-2 !h-2 !border-0" />
    </div>
</template>
