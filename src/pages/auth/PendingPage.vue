<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

async function handleLogout() {
    await auth.logout()
    router.push({ name: 'login' })
}
</script>

<template>
    <div class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/20 mb-4">
            <span class="text-3xl">⏳</span>
        </div>

        <h2 class="text-2xl font-heading font-bold text-navy mb-2">Account Pending</h2>

        <p class="text-gray-600 text-sm leading-relaxed mb-6">
            Your account is awaiting approval from a church administrator.
            You'll be notified once your account has been reviewed.
        </p>

        <button
            @click="handleLogout"
            class="w-full py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
            Sign Out
        </button>
    </div>
</template>
