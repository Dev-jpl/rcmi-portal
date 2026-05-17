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
                component: () => import('@/pages/member/QRCodePage.vue'),
                meta: { requiresApproved: true }
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
                path: 'events',
                meta: { requiresApproved: true },
                children: [
                    {
                        path: '',
                        name: 'member-events',
                        component: () => import('@/pages/member/EventsPage.vue')
                    },
                    {
                        path: ':id',
                        name: 'member-event-detail',
                        component: () => import('@/pages/member/EventDetailPage.vue'),
                        props: true
                    }
                ]
            },
            {
                path: 'devotional',
                name: 'member-devotional',
                component: () => import('@/pages/member/DevotionalWallPage.vue'),
                meta: { requiresApproved: true }
            },
            {
                path: 'prayer-requests',
                name: 'member-prayer-requests',
                component: () => import('@/pages/member/PrayerRequestsPage.vue'),
                meta: { requiresApproved: true }
            },
            {
                path: 'scripture',
                name: 'member-scripture',
                component: () => import('@/pages/member/ScriptureReadingPage.vue')
            },
            {
                path: 'programs',
                name: 'member-programs',
                component: () => import('@/pages/member/ProgramsPage.vue'),
                meta: { requiresApproved: true }
            },
            {
                path: 'announcements',
                name: 'member-announcements',
                component: () => import('@/pages/member/AnnouncementsPage.vue')
            },
            {
                path: 'directory',
                meta: { requiresApproved: true },
                children: [
                    {
                        path: '',
                        name: 'member-directory',
                        component: () => import('@/pages/member/MemberDirectoryPage.vue')
                    },
                    {
                        path: ':userId',
                        name: 'member-profile-view',
                        component: () => import('@/pages/member/MemberProfileViewPage.vue'),
                        props: true
                    }
                ]
            }
        ]
    }
]