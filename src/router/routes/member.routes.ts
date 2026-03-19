// src/router/routes/member.routes.ts
import type { RouteRecordRaw } from 'vue-router'

export const memberRoutes: RouteRecordRaw[] = [
    {
        path: '/app',
        meta: { layout: 'app', requiresAuth: true },
        children: [
            {
                path: '',
                redirect: { name: 'member-dashboard' }
            },
            {
                path: 'dashboard',
                name: 'member-dashboard',
                component: () => import('@/pages/member/DashboardPage.vue')
            },
            {
                path: 'profile',
                name: 'member-profile',
                component: () => import('@/pages/member/ProfilePage.vue')
            },
            {
                path: 'qr-code',
                name: 'member-qr',
                component: () => import('@/pages/member/QRCodePage.vue')
            },
            {
                path: 'attendance',
                children: [
                    {
                        path: '',
                        name: 'member-attendance',
                        component: () => import('@/pages/member/AttendancePage.vue')
                    },
                    {
                        path: 'check-in',
                        name: 'member-checkin',
                        component: () => import('@/pages/member/CheckInPage.vue')
                    }
                ]
            },
            {
                path: 'devotional',
                name: 'member-devotional',
                component: () => import('@/pages/member/DevotionalWallPage.vue')
            },
            {
                path: 'prayer-requests',
                name: 'member-prayer-requests',
                component: () => import('@/pages/member/PrayerRequestsPage.vue')
            },
            {
                path: 'programs',
                name: 'member-programs',
                component: () => import('@/pages/member/ProgramsPage.vue')
            },
            {
                path: 'announcements',
                name: 'member-announcements',
                component: () => import('@/pages/member/AnnouncementsPage.vue')
            },
            {
                path: 'directory',
                name: 'member-directory',
                component: () => import('@/pages/member/MemberDirectoryPage.vue')
            }
        ]
    }
]