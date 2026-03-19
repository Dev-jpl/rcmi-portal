// src/router/guards.ts
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export async function authGuard(
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
) {
    const auth = useAuthStore()

    // Wait for session to be resolved on first load
    if (!auth.resolved) await auth.resolveSession()

    if (!auth.user) {
        return next({ name: 'login', query: { redirect: to.fullPath } })
    }

    // Block pending members from accessing app
    if (auth.profile?.status === 'pending' && to.name !== 'pending') {
        return next({ name: 'pending' })
    }

    // Redirect rejected members to dedicated page
    if (auth.profile?.status === 'rejected' && to.name !== 'rejected') {
        return next({ name: 'rejected' })
    }

    return next()
}

export async function roleGuard(allowedRoles: string[]) {
    return async (
        _to: RouteLocationNormalized,
        _from: RouteLocationNormalized,
        next: NavigationGuardNext
    ) => {
        const auth = useAuthStore()

        if (!auth.resolved) await auth.resolveSession()

        if (!auth.user) return next({ name: 'login' })

        const userRole = auth.user.role_type ?? ''

        if (!allowedRoles.includes(userRole)) {
            return next({ name: 'member-dashboard' }) // redirect to safe fallback
        }

        return next()
    }
}

export async function guestGuard(
    _to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
) {
    const auth = useAuthStore()

    if (!auth.resolved) await auth.resolveSession()

    if (auth.user) {
        // Pending → pending page
        if (auth.profile?.status === 'pending') {
            return next({ name: 'pending' })
        }
        // Rejected → rejected page
        if (auth.profile?.status === 'rejected') {
            return next({ name: 'rejected' })
        }
        // Approved → dashboard
        if (auth.profile?.status === 'approved') {
            const role = auth.user.role_type
            const adminRoles = ['super_admin', 'admin', 'pastoral', 'network_leader']
            return next({ name: adminRoles.includes(role) ? 'admin-dashboard' : 'member-dashboard' })
        }
    }

    return next()
}
