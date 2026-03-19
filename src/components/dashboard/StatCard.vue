<script setup lang="ts">
defineProps<{
    icon?: string
    label: string
    value: string | number
    subLabel?: string
    variant?: 'navy' | 'gold' | 'green' | 'red' | 'default'
}>()

const variantClasses: Record<string, string> = {
    navy: 'text-navy',
    gold: 'text-gold-500',
    green: 'text-green-600',
    red: 'text-red-500',
    default: 'text-navy',
}
</script>

<template>
    <div class="bg-white rounded-xl p-5 border border-gray-200">
        <div class="flex items-start justify-between">
            <div>
                <p class="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{{ label }}</p>
                <p class="text-3xl font-heading font-bold" :class="variantClasses[variant ?? 'default']">
                    {{ value }}
                </p>
                <p v-if="subLabel" class="text-xs text-gray-400 mt-1">{{ subLabel }}</p>
            </div>
            <span v-if="icon" class="text-2xl">{{ icon }}</span>
        </div>
        <slot />
    </div>
</template>
