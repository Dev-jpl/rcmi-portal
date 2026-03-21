<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const auth = useAuthStore()
const ready = ref(false)

onMounted(async () => {
    await auth.resolveSession()
    ready.value = true
})

const layouts: Record<string, ReturnType<typeof defineAsyncComponent>> = {
    auth: defineAsyncComponent(() => import('@/layouts/AuthLayout.vue')),
    app: defineAsyncComponent(() => import('@/layouts/AppLayout.vue')),
    admin: defineAsyncComponent(() => import('@/layouts/AdminLayout.vue')),
}

const layout = computed(() => {
    const name = (route.meta.layout as string)
        ?? (route.matched.find(r => r.meta.layout)?.meta.layout as string)
        ?? 'auth'
    return layouts[name] ?? layouts.auth
})
</script>

<template>
    <!-- Show nothing until session is resolved to prevent login flash -->
    <div v-if="!ready" class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center">
            <div class="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shadow-lg shadow-gold/20 mx-auto mb-3">
                <span class="text-navy font-heading font-extrabold text-sm">R</span>
            </div>
            <div class="w-5 h-5 border-2 border-navy/20 border-t-navy rounded-full animate-spin mx-auto" />
        </div>
    </div>
    <component v-else :is="layout">
        <router-view />
    </component>
</template>
