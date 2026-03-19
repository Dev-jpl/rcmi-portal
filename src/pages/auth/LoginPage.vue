<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')

async function handleLogin() {
    const result = await auth.login(email.value, password.value)
    if (!result.success) return

    if (auth.isPending) {
        router.push({ name: 'pending' })
    } else if (auth.isAdmin || auth.isLeader) {
        router.push({ name: 'admin-dashboard' })
    } else {
        router.push({ name: 'member-dashboard' })
    }
}
</script>

<template>
    <div>
        <h2 class="text-2xl font-heading font-bold text-navy text-center mb-1">Welcome Back</h2>
        <p class="text-sm text-gray-500 text-center mb-6">Sign in to your account</p>

        <form @submit.prevent="handleLogin" class="space-y-4">
            <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                    id="email"
                    v-model="email"
                    type="email"
                    required
                    autocomplete="email"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="you@example.com"
                />
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                    id="password"
                    v-model="password"
                    type="password"
                    required
                    autocomplete="current-password"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="••••••••"
                />
            </div>

            <!-- Error -->
            <p v-if="auth.error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {{ auth.error }}
            </p>

            <button
                type="submit"
                :disabled="auth.loading"
                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <span v-if="auth.loading">Signing in...</span>
                <span v-else>Sign In</span>
            </button>
        </form>

        <p class="mt-6 text-center text-sm text-gray-500">
            Don't have an account?
            <router-link :to="{ name: 'register' }" class="text-navy font-semibold hover:underline">
                Register
            </router-link>
        </p>
    </div>
</template>
