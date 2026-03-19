<script setup lang="ts">
defineProps<{
    status: string
}>()

const colors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
    active: 'bg-blue-100 text-blue-700',
    inactive: 'bg-gray-100 text-gray-500',
}
</script>

<template>
    <span
        class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize"
        :class="colors[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-500'"
    >
        {{ status }}
    </span>
</template>
