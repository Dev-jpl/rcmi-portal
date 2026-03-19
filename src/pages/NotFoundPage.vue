<script setup lang="ts">
</script>

<template>
    <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div class="text-center">
            <h1 class="text-8xl font-heading font-extrabold text-navy/20 mb-2">404</h1>
            <h2 class="text-xl font-heading font-bold text-navy mb-2">Page Not Found</h2>
            <p class="text-gray-500 text-sm mb-8">The page you're looking for doesn't exist or has been moved.</p>
            <router-link
                to="/"
                class="inline-block px-6 py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 transition-colors"
            >
                Go Home
            </router-link>
        </div>
    </div>
</template>
