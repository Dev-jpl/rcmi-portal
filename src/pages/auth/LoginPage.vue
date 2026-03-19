<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

// Client-side validation
const emailError = ref('')
const passwordError = ref('')
const touched = ref({ email: false, password: false })

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

watch(email, () => { if (touched.value.email) validateEmail() })
watch(password, () => { if (touched.value.password) validatePassword() })

// Friendly error messages
const friendlyError = computed(() => {
    if (!auth.error) return ''
    const e = auth.error.toLowerCase()
    if (e.includes('invalid login credentials') || e.includes('invalid_credentials')) {
        return 'Incorrect email or password. Please check your credentials and try again.'
    }
    if (e.includes('email not confirmed')) {
        return 'Please verify your email address first. Check your inbox for a confirmation link.'
    }
    if (e.includes('too many requests') || e.includes('rate limit')) {
        return 'Too many login attempts. Please wait a moment before trying again.'
    }
    if (e.includes('network') || e.includes('fetch')) {
        return 'Unable to connect to the server. Please check your internet connection.'
    }
    if (e.includes('user not found')) {
        return 'No account found with this email. Would you like to register instead?'
    }
    return auth.error
})

async function handleLogin() {
    touched.value = { email: true, password: true }
    const emailValid = validateEmail()
    const passwordValid = validatePassword()

    if (!emailValid || !passwordValid) return

    auth.error = null
    const result = await auth.login(email.value.trim(), password.value)
    if (!result.success) return

    // Redirect logic
    const redirect = route.query.redirect as string | undefined

    if (auth.profile?.status === 'rejected') {
        // Stay on login, error will show
        auth.error = 'Your account has been declined. Please contact your church administrator for assistance.'
        await auth.logout()
        return
    }

    if (auth.isPending) {
        router.push({ name: 'pending' })
    } else if (redirect && redirect !== '/login' && redirect !== '/register') {
        router.push(redirect)
    } else if (auth.isAdmin || auth.isLeader) {
        router.push({ name: 'admin-dashboard' })
    } else {
        router.push({ name: 'member-dashboard' })
    }
}
</script>

<template>
    <div>
        <div class="text-center mb-7">
            <h2 class="text-2xl font-heading font-bold text-navy mb-1">Welcome back</h2>
            <p class="text-sm text-gray-400">Sign in to your RCMI account to continue</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-5" novalidate>
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
                        :class="touched.email && emailError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'"
                        placeholder="you@example.com"
                        @blur="touched.email = true; validateEmail()"
                    />
                </div>
                <p v-if="touched.email && emailError" class="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {{ emailError }}
                </p>
            </div>

            <!-- Password -->
            <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
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
                        autocomplete="current-password"
                        class="w-full pl-11 pr-11 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
                        :class="touched.password && passwordError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'"
                        placeholder="Enter your password"
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

            <!-- Server Error -->
            <div v-if="friendlyError" class="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                    <p class="text-sm text-red-700 font-medium">Sign in failed</p>
                    <p class="text-xs text-red-600/80 mt-0.5">{{ friendlyError }}</p>
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
                {{ auth.loading ? 'Signing in...' : 'Sign In' }}
            </button>
        </form>

        <div class="mt-7 pt-6 border-t border-gray-100 text-center">
            <p class="text-sm text-gray-400">
                Don't have an account?
                <router-link :to="{ name: 'register' }" class="text-navy font-semibold hover:text-navy-600 transition-colors">
                    Create one here
                </router-link>
            </p>
        </div>
    </div>
</template>
