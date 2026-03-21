<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()

const email = ref('')
const emailError = ref('')
const touched = ref(false)
const sent = ref(false)

function validateEmail() {
    if (!email.value) {
        emailError.value = 'Email address is required'
        return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        emailError.value = 'Please enter a valid email address'
        return false
    }
    emailError.value = ''
    return true
}

watch(email, () => { if (touched.value) validateEmail() })

async function handleSubmit() {
    touched.value = true
    if (!validateEmail()) return

    auth.error = null
    const result = await auth.forgotPassword(email.value.trim())
    if (result.success) {
        sent.value = true
    }
}
</script>

<template>
    <div>
        <!-- Success State -->
        <template v-if="sent">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-5">
                    <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                </div>
                <h2 class="text-2xl font-heading font-bold text-navy mb-2">Check your email</h2>
                <p class="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs mx-auto">
                    We've sent a password reset link to <span class="font-medium text-gray-700">{{ email }}</span>. Please check your inbox and follow the instructions.
                </p>
                <p class="text-xs text-gray-400 mb-6">Didn't receive an email? Check your spam folder or try again.</p>

                <div class="space-y-3">
                    <button
                        @click="sent = false; email = ''; touched = false"
                        class="w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 transition-all duration-200"
                    >
                        Try another email
                    </button>
                    <router-link
                        :to="{ name: 'login' }"
                        class="block w-full py-3 border border-gray-200 text-gray-500 font-medium rounded-xl hover:bg-gray-50 transition-colors text-center text-sm"
                    >
                        Back to Sign In
                    </router-link>
                </div>
            </div>
        </template>

        <!-- Form State -->
        <template v-else>
            <div class="text-center mb-7">
                <h2 class="text-2xl font-heading font-bold text-navy mb-1">Forgot password?</h2>
                <p class="text-sm text-gray-400">Enter your email and we'll send you a reset link</p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
                <!-- Email -->
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg class="w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <input
                            id="email"
                            v-model="email"
                            type="email"
                            autocomplete="email"
                            class="w-full pl-11 pr-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
                            :class="touched && emailError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'"
                            placeholder="you@example.com"
                            @blur="touched = true; validateEmail()"
                        />
                    </div>
                    <p v-if="touched && emailError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {{ emailError }}
                    </p>
                </div>

                <!-- Server Error -->
                <div v-if="auth.error" class="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                        <p class="text-sm text-red-700 font-medium">Something went wrong</p>
                        <p class="text-xs text-red-600/80 mt-0.5">{{ auth.error }}</p>
                    </div>
                </div>

                <!-- Submit -->
                <button
                    type="submit"
                    :disabled="auth.loading"
                    class="w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <svg v-if="auth.loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {{ auth.loading ? 'Sending...' : 'Send Reset Link' }}
                </button>
            </form>

            <div class="mt-7 pt-6 border-t border-gray-100 text-center">
                <p class="text-sm text-gray-400">
                    Remember your password?
                    <router-link :to="{ name: 'login' }" class="text-navy font-semibold hover:text-navy-600 transition-colors">
                        Sign in
                    </router-link>
                </p>
            </div>
        </template>
    </div>
</template>
