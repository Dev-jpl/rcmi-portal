// src/router/routes/admin.routes.ts
import type { RouteRecordRaw } from 'vue-router'

const ADMIN_ROLES = ['super_admin', 'admin', 'pastoral', 'network_leader']

export const adminRoutes: RouteRecordRaw[] = [
    {
        path: '/admin',
        meta: {
            layout: 'admin',
            requiresAuth: true,
            roles: ADMIN_ROLES
        },
        children: [
            {
                path: '',
                redirect: { name: 'admin-dashboard' }
            },
            {
                path: 'dashboard',
                name: 'admin-dashboard',
                component: () => import('@/pages/admin/DashboardPage.vue')
            },
            {
                path: 'members',
                children: [
                    {
                        path: '',
                        name: 'admin-members',
                        component: () => import('@/pages/admin/MembersPage.vue')
                    },
                    {
                        path: ':id',
                        name: 'admin-member-detail',
                        component: () => import('@/pages/admin/MemberDetailPage.vue'),
                        props: true
                    }
                ]
            },
            {
                path: 'events',
                children: [
                    {
                        path: '',
                        name: 'admin-events',
                        component: () => import('@/pages/admin/EventsPage.vue')
                    },
                    {
                        path: ':id',
                        name: 'admin-event-detail',
                        component: () => import('@/pages/admin/EventDetailPage.vue'),
                        props: true
                    }
                ]
            },
            {
                path: 'attendance',
                children: [
                    {
                        path: '',
                        name: 'admin-attendance',
                        component: () => import('@/pages/admin/AttendancePage.vue')
                    },
                    {
                        path: 'scan',
                        name: 'admin-qr-scan',
                        component: () => import('@/pages/admin/QRScanPage.vue'),
                        // Only leaders can scan QR
                        meta: { roles: ['super_admin', 'admin', 'pastoral', 'network_leader', 'lpath_leader'] }
                    }
                ]
            },
            {
                path: 'churches',
                name: 'admin-churches',
                component: () => import('@/pages/admin/ChurchesPage.vue'),
                // Only super admin manages churches
                meta: { roles: ['super_admin'] }
            },
            {
                path: 'reports',
                name: 'admin-reports',
                component: () => import('@/pages/admin/ReportsPage.vue')
            },
            {
                path: 'announcements',
                name: 'admin-announcements',
                component: () => import('@/pages/admin/AnnouncementsPage.vue')
            },
            {
                path: 'audit-log',
                name: 'admin-audit-log',
                component: () => import('@/pages/admin/AuditLogPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            }
        ]
    }
]