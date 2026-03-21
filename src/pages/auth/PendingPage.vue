<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const auth = useAuthStore()
const router = useRouter()
const checking = ref(false)

// Poll for approval status every 30 seconds
let pollInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    pollInterval = setInterval(checkStatus, 30000)
})

onUnmounted(() => {
    if (pollInterval) clearInterval(pollInterval)
})

async function checkStatus() {
    if (checking.value || !auth.session?.user) return
    checking.value = true

    await auth.fetchUserData(auth.session.user.id)

    if (auth.profile?.status === 'approved') {
        if (pollInterval) clearInterval(pollInterval)
        if (auth.canAccessAdmin) {
            const target = auth.isAdmin ? 'admin-dashboard'
                : auth.isPastor ? 'admin-my-team'
                : auth.isNetworkLeader ? 'admin-my-network'
                : 'admin-my-lpath'
            router.push({ name: target })
        } else {
            router.push({ name: 'member-dashboard' })
        }
    } else if (auth.profile?.status === 'rejected') {
        if (pollInterval) clearInterval(pollInterval)
        await auth.logout()
        router.push({ name: 'login' })
    }

    checking.value = false
}

async function handleLogout() {
    if (pollInterval) clearInterval(pollInterval)
    await auth.logout()
    router.push({ name: 'login' })
}

async function handleRefresh() {
    await checkStatus()
}
</script>

<template>
    <div class="text-center">
        <!-- Icon -->
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/15 mb-5">
            <svg class="w-8 h-8 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>

        <h2 class="text-2xl font-heading font-bold text-navy mb-2">Account under review</h2>

        <p class="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs mx-auto">
            Your registration has been submitted successfully. A church administrator will review and approve your account.
        </p>

        <!-- Steps -->
        <div class="bg-gray-50 rounded-xl p-5 mb-6 text-left">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">What happens next?</p>
            <div class="space-y-4">
                <div class="flex items-start gap-3">
                    <div class="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-800">Account created</p>
                        <p class="text-xs text-gray-400">Your registration details have been saved</p>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <div class="w-7 h-7 rounded-lg bg-gold/20 flex items-center justify-center shrink-0">
                        <div class="w-2.5 h-2.5 rounded-full bg-gold animate-pulse" />
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-800">Waiting for approval</p>
                        <p class="text-xs text-gray-400">Your church admin is reviewing your request</p>
                    </div>
                </div>
                <div class="flex items-start gap-3 opacity-40">
                    <div class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-800">Access granted</p>
                        <p class="text-xs text-gray-400">You'll be redirected to the portal automatically</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Refresh -->
        <button
            @click="handleRefresh"
            :disabled="checking"
            class="w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 mb-3"
        >
            <svg
                class="w-4 h-4 transition-transform"
                :class="{ 'animate-spin': checking }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {{ checking ? 'Checking status...' : 'Check approval status' }}
        </button>

        <button
            @click="handleLogout"
            class="w-full py-3 border border-gray-200 text-gray-500 font-medium rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm"
        >
            Sign out &amp; return later
        </button>

        <p class="text-[11px] text-gray-300 mt-5">
            This page auto-checks every 30 seconds. You can also close the browser and sign in later.
        </p>
    </div>
</template>
