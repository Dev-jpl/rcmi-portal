// src/router/routes/auth.routes.ts
import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        path: '/register',
        name: 'register',
        component: () => import('@/pages/auth/RegisterPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        path: '/forgot-password',
        name: 'forgot-password',
        component: () => import('@/pages/auth/ForgotPasswordPage.vue'),
        meta: { layout: 'auth', guest: true }
    },
    {
        path: '/reset-password',
        name: 'reset-password',
        component: () => import('@/pages/auth/ResetPasswordPage.vue'),
        meta: { layout: 'auth' }
    },
    {
        path: '/pending',
        name: 'pending',
        component: () => import('@/pages/auth/PendingPage.vue'),
        meta: { layout: 'auth' }
    },
    {
        path: '/rejected',
        name: 'rejected',
        component: () => import('@/pages/auth/RejectedPage.vue'),
        meta: { layout: 'auth' }
    },
    {
        path: '/auth/callback',
        name: 'auth-callback',
        component: () => import('@/pages/auth/AuthCallbackPage.vue'),
        meta: { layout: 'auth' }
    }
]
