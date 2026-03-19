// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { authGuard, guestGuard, roleGuard } from './guards'
import { authRoutes } from './routes/auth.routes'
import { memberRoutes } from './routes/member.routes'
import { adminRoutes } from './routes/admin.routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    // Root redirect
    {
      path: '/',
      redirect: '/login'
    },

    // Auth pages (login, register, pending)
    ...authRoutes,

    // Member-facing pages
    ...memberRoutes,

    // Admin / leader pages
    ...adminRoutes,

    // 404 fallback
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue')
    }
  ]
})

// ── Global Navigation Guards ──────────────────────────────────

router.beforeEach(async (to, from, next) => {
  // Guest-only pages (login, register)
  if (to.meta.guest) {
    return guestGuard(to, from, next)
  }

  // Protected pages
  if (to.meta.requiresAuth) {
    // First check auth
    await authGuard(to, from, next)

    // Then check role if specified on the route
    const requiredRoles = to.meta.roles as string[] | undefined
    if (requiredRoles?.length) {
      const guard = await roleGuard(requiredRoles)
      return guard(to, from, next)
    }
  }

  return next()
})

export default router