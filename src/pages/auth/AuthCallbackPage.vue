<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()
const status = ref<'verifying' | 'success' | 'error'>('verifying')
const errorMessage = ref('')

onMounted(async () => {
    try {
        // Supabase handles the token exchange automatically via the URL hash
        // We just need to wait for the session to be established
        await auth.resolveSession()

        if (auth.session) {
            status.value = 'success'

            // Short delay so user sees the success state
            setTimeout(() => {
                if (auth.isPending) {
                    router.replace({ name: 'pending' })
                } else if (auth.isRejected) {
                    router.replace({ name: 'rejected' })
                } else if (auth.canAccessAdmin) {
                    const target = auth.isAdmin ? 'admin-dashboard'
                        : auth.isPastor ? 'admin-my-team'
                        : auth.isNetworkLeader ? 'admin-my-network'
                        : 'admin-my-lpath'
                    router.replace({ name: target })
                } else {
                    router.replace({ name: 'member-dashboard' })
                }
            }, 2000)
        } else {
            status.value = 'error'
            errorMessage.value = 'Unable to verify your email. The link may have expired.'
        }
    } catch (e: any) {
        status.value = 'error'
        errorMessage.value = e.message ?? 'Verification failed. Please try again.'
    }
})
</script>

<template>
    <div class="text-center">
        <!-- Verifying -->
        <template v-if="status === 'verifying'">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy/10 mb-5">
                <svg class="w-7 h-7 text-navy animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
            <h2 class="text-2xl font-heading font-bold text-navy mb-2">Verifying your email</h2>
            <p class="text-sm text-gray-400">Please wait while we confirm your account...</p>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-5">
                <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h2 class="text-2xl font-heading font-bold text-navy mb-2">Email verified!</h2>
            <p class="text-sm text-gray-400 mb-4">Your email has been confirmed successfully.</p>
            <p class="text-xs text-gray-300">Redirecting you now...</p>
        </template>

        <!-- Error -->
        <template v-else>
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-5">
                <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </div>
            <h2 class="text-2xl font-heading font-bold text-navy mb-2">Verification failed</h2>
            <p class="text-sm text-gray-500 mb-6 max-w-xs mx-auto">{{ errorMessage }}</p>

            <div class="space-y-3">
                <router-link
                    :to="{ name: 'login' }"
                    class="block w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 transition-all duration-200 text-center"
                >
                    Go to Sign In
                </router-link>
                <router-link
                    :to="{ name: 'register' }"
                    class="block w-full py-3 border border-gray-200 text-gray-500 font-medium rounded-xl hover:bg-gray-50 transition-colors text-center text-sm"
                >
                    Register again
                </router-link>
            </div>
        </template>
    </div>
</template>
