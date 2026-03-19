<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const reason = auth.profile?.rejected_reason

async function handleLogout() {
    await auth.logout()
    router.push({ name: 'login' })
}
</script>

<template>
    <div class="text-center">
        <!-- Icon -->
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-5">
            <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
        </div>

        <h2 class="text-2xl font-heading font-bold text-navy mb-2">Account not approved</h2>

        <p class="text-gray-500 text-sm leading-relaxed mb-5 max-w-xs mx-auto">
            Unfortunately, your registration was not approved by the church administrator.
        </p>

        <!-- Reason -->
        <div v-if="reason" class="bg-red-50/50 border border-red-100 rounded-xl px-5 py-4 mb-6 text-left">
            <p class="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5">Reason provided</p>
            <p class="text-sm text-red-700 leading-relaxed">{{ reason }}</p>
        </div>

        <!-- What to do -->
        <div class="bg-gray-50 rounded-xl p-5 mb-6 text-left">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">What can you do?</p>
            <div class="space-y-3">
                <div class="flex items-start gap-3">
                    <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    <p class="text-sm text-gray-600">Contact your satellite church leader for clarification</p>
                </div>
                <div class="flex items-start gap-3">
                    <svg class="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    <p class="text-sm text-gray-600">You may register again with corrected information if needed</p>
                </div>
            </div>
        </div>

        <button
            @click="handleLogout"
            class="w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 transition-all duration-200"
        >
            Return to Sign In
        </button>
    </div>
</template>
