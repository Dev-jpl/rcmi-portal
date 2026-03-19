<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

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
    <component :is="layout">
        <router-view />
    </component>
</template>
