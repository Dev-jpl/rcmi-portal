<script setup lang="ts">
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-900 via-navy to-navy-700 px-4">
        <!-- Logo -->
        <div class="mb-8 text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold mb-4">
                <span class="text-navy font-heading font-extrabold text-2xl">R</span>
            </div>
            <h1 class="text-2xl font-heading font-bold text-white">RCMI Portal</h1>
            <p class="text-navy-200 text-sm mt-1">Reach · Connect · Mobilize · Inspire</p>
        </div>

        <!-- Card -->
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
            <slot />
        </div>
    </div>
</template>
