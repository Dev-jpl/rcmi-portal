// src/router/routes/admin.routes.ts
import type { RouteRecordRaw } from 'vue-router'

// Parent-level roles — anyone with admin role OR active leadership assignment can enter /admin
// Individual routes further restrict via their own meta.roles
const ADMIN_ROLES = ['super_admin', 'admin', 'pastoral', 'network_leader', 'lpath_leader']

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
                name: 'admin-root',
                redirect: () => {
                    // Dynamic redirect handled by AdminLayout or router guard
                    return { name: 'admin-dashboard' }
                }
            },
            {
                path: 'dashboard',
                name: 'admin-dashboard',
                component: () => import('@/pages/admin/DashboardPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'members',
                meta: { roles: ['super_admin', 'admin'] },
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
                meta: { roles: ['super_admin', 'admin'] },
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
                path: 'default-events',
                name: 'admin-default-events',
                component: () => import('@/pages/admin/DefaultEventsPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'programs',
                meta: { roles: ['super_admin', 'admin'] },
                children: [
                    {
                        path: '',
                        name: 'admin-programs',
                        component: () => import('@/pages/admin/ProgramsPage.vue')
                    },
                    {
                        path: ':id',
                        name: 'admin-program-detail',
                        component: () => import('@/pages/admin/ProgramDetailPage.vue'),
                        props: true
                    }
                ]
            },
            {
                path: 'attendance',
                meta: { roles: ['super_admin', 'admin'] },
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
                component: () => import('@/pages/admin/ReportsPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'announcements',
                name: 'admin-announcements',
                component: () => import('@/pages/admin/AnnouncementsPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'bod-members',
                name: 'admin-bod-members',
                component: () => import('@/pages/admin/BodMembersPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'pastoral-members',
                name: 'admin-pastoral-members',
                component: () => import('@/pages/admin/PastoralMembersPage.vue'),
                meta: { roles: ['super_admin', 'admin'] }
            },
            {
                path: 'network-leaders',
                name: 'admin-network-leaders',
                component: () => import('@/pages/admin/NetworkLeadersPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral'] }
            },
            {
                path: 'lpath-leaders',
                name: 'admin-lpath-leaders',
                component: () => import('@/pages/admin/LpathLeadersPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral'] }
            },
            {
                path: 'lpath-members',
                name: 'admin-lpath-members',
                component: () => import('@/pages/admin/LpathMembersPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral', 'network_leader'] }
            },
            {
                path: 'my-team',
                name: 'admin-my-team',
                component: () => import('@/pages/admin/PastorDashboardPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral'] }
            },
            {
                path: 'my-network',
                name: 'admin-my-network',
                component: () => import('@/pages/admin/NetworkDashboardPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral', 'network_leader'] }
            },
            {
                path: 'my-lpath',
                name: 'admin-my-lpath',
                component: () => import('@/pages/admin/LpathDashboardPage.vue'),
                meta: { roles: ['super_admin', 'admin', 'pastoral', 'network_leader', 'lpath_leader'] }
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