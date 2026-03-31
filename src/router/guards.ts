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

    // Removed pending block: pending users can now access member-dashboard but with restricted privileges

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

        // Check role_type first
        if (allowedRoles.includes(userRole)) return next()

        // Check leadership assignments
        if (allowedRoles.includes('pastoral') && auth.isPastor) return next()
        if (allowedRoles.includes('network_leader') && auth.isNetworkLeader) return next()
        if (allowedRoles.includes('lpath_leader') && auth.isLpathLeader) return next()
        if (allowedRoles.includes('ministry_head') && auth.isMinistryHead) return next()

        // Leader without access to this specific page — redirect to their scoped page
        if (auth.hasLeadershipRole) {
            const fallback = auth.isPastor ? 'admin-my-team'
                : auth.isNetworkLeader ? 'admin-my-network'
                : auth.isLpathLeader ? 'admin-my-lpath'
                : 'admin-my-ministry'
            return next({ name: fallback })
        }

        return next({ name: 'member-dashboard' })
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
        // Pending → dashboard (with restricted UI)
        if (auth.profile?.status === 'pending') {
            return next({ name: 'member-dashboard' })
        }
        // Rejected → rejected page
        if (auth.profile?.status === 'rejected') {
            return next({ name: 'rejected' })
        }
        // Approved → dashboard
        if (auth.profile?.status === 'approved') {
            if (auth.isAdmin) return next({ name: 'admin-dashboard' })
            if (auth.isPastor) return next({ name: 'admin-my-team' })
            if (auth.isNetworkLeader) return next({ name: 'admin-my-network' })
            if (auth.isLpathLeader) return next({ name: 'admin-my-lpath' })
            if (auth.isMinistryHead) return next({ name: 'admin-my-ministry' })
            return next({ name: 'member-dashboard' })
        }
    }

    return next()
}
