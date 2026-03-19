<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase'

const auth = useAuthStore()
const router = useRouter()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const satelliteChurchId = ref<number | null>(null)

const churches = ref<{ id: number; church_name: string }[]>([])
const loadingChurches = ref(true)

onMounted(async () => {
    const { data } = await supabase
        .from('lib_satellite_churches')
        .select('id, church_name')
        .order('church_name')
    churches.value = data ?? []
    loadingChurches.value = false
})

async function handleRegister() {
    if (!satelliteChurchId.value) return

    const result = await auth.register({
        email: email.value,
        password: password.value,
        firstName: firstName.value,
        lastName: lastName.value,
        satelliteChurchId: satelliteChurchId.value,
    })

    if (result.success) {
        router.push({ name: 'pending' })
    }
}
</script>

<template>
    <div>
        <h2 class="text-2xl font-heading font-bold text-navy text-center mb-1">Create Account</h2>
        <p class="text-sm text-gray-500 text-center mb-6">Join the RCMI community</p>

        <form @submit.prevent="handleRegister" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                        id="firstName"
                        v-model="firstName"
                        type="text"
                        required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    />
                </div>
                <div>
                    <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                        id="lastName"
                        v-model="lastName"
                        type="text"
                        required
                        class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    />
                </div>
            </div>

            <div>
                <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                    id="reg-email"
                    v-model="email"
                    type="email"
                    required
                    autocomplete="email"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="you@example.com"
                />
            </div>

            <div>
                <label for="reg-password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                    id="reg-password"
                    v-model="password"
                    type="password"
                    required
                    minlength="6"
                    autocomplete="new-password"
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                    placeholder="At least 6 characters"
                />
            </div>

            <div>
                <label for="church" class="block text-sm font-medium text-gray-700 mb-1">Satellite Church</label>
                <select
                    id="church"
                    v-model="satelliteChurchId"
                    required
                    class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                >
                    <option :value="null" disabled>
                        {{ loadingChurches ? 'Loading churches...' : 'Select your church' }}
                    </option>
                    <option v-for="church in churches" :key="church.id" :value="church.id">
                        {{ church.church_name }}
                    </option>
                </select>
            </div>

            <!-- Error -->
            <p v-if="auth.error" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {{ auth.error }}
            </p>

            <button
                type="submit"
                :disabled="auth.loading || !satelliteChurchId"
                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <span v-if="auth.loading">Creating account...</span>
                <span v-else>Register</span>
            </button>
        </form>

        <p class="mt-6 text-center text-sm text-gray-500">
            Already have an account?
            <router-link :to="{ name: 'login' }" class="text-navy font-semibold hover:underline">
                Sign In
            </router-link>
        </p>
    </div>
</template>
