<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const passwordError = ref('')
const confirmError = ref('')
const touched = ref({ password: false, confirm: false })
const success = ref(false)
const sessionReady = ref(false)
const sessionError = ref(false)

onMounted(async () => {
    // Supabase sets session from the URL hash automatically
    await auth.resolveSession()

    if (auth.session) {
        sessionReady.value = true
    } else {
        sessionError.value = true
    }
})

function validatePassword() {
    if (!password.value) {
        passwordError.value = 'Password is required'
        return false
    }
    if (password.value.length < 6) {
        passwordError.value = 'Password must be at least 6 characters'
        return false
    }
    passwordError.value = ''
    return true
}

function validateConfirm() {
    if (!confirmPassword.value) {
        confirmError.value = 'Please confirm your password'
        return false
    }
    if (confirmPassword.value !== password.value) {
        confirmError.value = 'Passwords do not match'
        return false
    }
    confirmError.value = ''
    return true
}

watch(password, () => {
    if (touched.value.password) validatePassword()
    if (touched.value.confirm && confirmPassword.value) validateConfirm()
})
watch(confirmPassword, () => { if (touched.value.confirm) validateConfirm() })

async function handleSubmit() {
    touched.value = { password: true, confirm: true }
    const pwValid = validatePassword()
    const cfValid = validateConfirm()
    if (!pwValid || !cfValid) return

    auth.error = null
    const result = await auth.updatePassword(password.value)
    if (result.success) {
        success.value = true
        setTimeout(() => {
            router.push({ name: 'login' })
        }, 3000)
    }
}
</script>

<template>
    <div>
        <!-- Session Error -->
        <template v-if="sessionError">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-5">
                    <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h2 class="text-2xl font-heading font-bold text-navy mb-2">Invalid or expired link</h2>
                <p class="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                    This password reset link is no longer valid. Please request a new one.
                </p>
                <router-link
                    :to="{ name: 'forgot-password' }"
                    class="block w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 transition-all duration-200 text-center"
                >
                    Request new reset link
                </router-link>
            </div>
        </template>

        <!-- Loading Session -->
        <template v-else-if="!sessionReady">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy/10 mb-5">
                    <svg class="w-7 h-7 text-navy animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
                <h2 class="text-2xl font-heading font-bold text-navy mb-2">Verifying your link</h2>
                <p class="text-sm text-gray-400">Please wait...</p>
            </div>
        </template>

        <!-- Success -->
        <template v-else-if="success">
            <div class="text-center">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-50 mb-5">
                    <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 class="text-2xl font-heading font-bold text-navy mb-2">Password updated!</h2>
                <p class="text-sm text-gray-500 mb-4">Your password has been changed successfully.</p>
                <p class="text-xs text-gray-300">Redirecting to sign in...</p>
            </div>
        </template>

        <!-- Reset Form -->
        <template v-else>
            <div class="text-center mb-7">
                <h2 class="text-2xl font-heading font-bold text-navy mb-1">Set new password</h2>
                <p class="text-sm text-gray-400">Enter your new password below</p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-5" novalidate>
                <!-- New Password -->
                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg class="w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                        </div>
                        <input
                            id="password"
                            v-model="password"
                            :type="showPassword ? 'text' : 'password'"
                            autocomplete="new-password"
                            class="w-full pl-11 pr-11 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
                            :class="touched.password && passwordError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'"
                            placeholder="At least 6 characters"
                            @blur="touched.password = true; validatePassword()"
                        />
                        <button
                            type="button"
                            class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            @click="showPassword = !showPassword"
                        >
                            <svg v-if="!showPassword" class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <svg v-else class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        </button>
                    </div>
                    <p v-if="touched.password && passwordError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {{ passwordError }}
                    </p>
                </div>

                <!-- Confirm Password -->
                <div>
                    <label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg class="w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                        </div>
                        <input
                            id="confirm-password"
                            v-model="confirmPassword"
                            :type="showConfirm ? 'text' : 'password'"
                            autocomplete="new-password"
                            class="w-full pl-11 pr-11 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
                            :class="touched.confirm && confirmError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'"
                            placeholder="Re-enter your password"
                            @blur="touched.confirm = true; validateConfirm()"
                        />
                        <button
                            type="button"
                            class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            @click="showConfirm = !showConfirm"
                        >
                            <svg v-if="!showConfirm" class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <svg v-else class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                        </button>
                    </div>
                    <p v-if="touched.confirm && confirmError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        {{ confirmError }}
                    </p>
                </div>

                <!-- Server Error -->
                <div v-if="auth.error" class="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                        <p class="text-sm text-red-700 font-medium">Update failed</p>
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
                    {{ auth.loading ? 'Updating...' : 'Update Password' }}
                </button>
            </form>
        </template>
    </div>
</template>
