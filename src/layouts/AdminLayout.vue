<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import NotificationBell from '@/components/common/NotificationBell.vue'

const auth = useAuthStore()
const router = useRouter()
const sidebarOpen = ref(false)
const showUserMenu = ref(false)


const icons = {
    dashboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"/>`,
    members: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>`,
    events: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>`,
    attendance: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    announcements: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/>`,
    churches: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/>`,
    reports: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>`,
    audit: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>`,
    bod: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"/>`,
    pastoral: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>`,
    network: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>`,
    lpath: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/>`,
    myteam: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>`,
}

interface NavItem {
    label: string
    to: { name: string }
    iconKey: keyof typeof icons
    badge?: boolean
}

interface NavGroup {
    title: string
    items: NavItem[]
}

const navGroups = computed<NavGroup[]>(() => {
    const groups: NavGroup[] = []

    // Admin-only sections
    if (auth.isAdmin) {
        groups.push({
            title: 'Overview',
            items: [
                { label: 'Dashboard', to: { name: 'admin-dashboard' }, iconKey: 'dashboard' },
            ],
        })
        groups.push({
            title: 'People & Events',
            items: [
                { label: 'Members', to: { name: 'admin-members' }, iconKey: 'members', badge: true },
                { label: 'Events', to: { name: 'admin-events' }, iconKey: 'events' },
                { label: 'Attendance', to: { name: 'admin-attendance' }, iconKey: 'attendance' },
            ],
        })

        // Leadership CRUD (admin only)
        const leadershipItems: NavItem[] = [
            { label: 'BOD Members', to: { name: 'admin-bod-members' }, iconKey: 'bod' },
            { label: 'Pastors', to: { name: 'admin-pastoral-members' }, iconKey: 'pastoral' },
            { label: 'Network Leaders', to: { name: 'admin-network-leaders' }, iconKey: 'network' },
            { label: 'L-Path Leaders', to: { name: 'admin-lpath-leaders' }, iconKey: 'lpath' },
            { label: 'L-Path Members', to: { name: 'admin-lpath-members' }, iconKey: 'members' },
        ]
        groups.push({ title: 'Leadership', items: leadershipItems })

        groups.push({
            title: 'Content',
            items: [
                { label: 'Announcements', to: { name: 'admin-announcements' }, iconKey: 'announcements' },
            ],
        })
        groups.push({
            title: 'System',
            items: [
                { label: 'Churches', to: { name: 'admin-churches' }, iconKey: 'churches' },
                { label: 'Reports', to: { name: 'admin-reports' }, iconKey: 'reports' },
                { label: 'Audit Log', to: { name: 'admin-audit-log' }, iconKey: 'audit' },
            ],
        })
    }

    // Scoped management sections (based on active assignments)
    const scopedItems: NavItem[] = []
    if (auth.isPastor) {
        scopedItems.push({ label: 'Network Management', to: { name: 'admin-my-team' }, iconKey: 'myteam' })
    }
    if (auth.isNetworkLeader) {
        scopedItems.push({ label: 'My Network', to: { name: 'admin-my-network' }, iconKey: 'network' })
    }
    if (auth.isLpathLeader) {
        scopedItems.push({ label: 'My L-Path', to: { name: 'admin-my-lpath' }, iconKey: 'lpath' })
    }
    if (scopedItems.length) {
        groups.push({ title: 'My Management', items: scopedItems })
    }

    return groups
})

async function handleLogout() {
    await auth.logout()
    router.push({ name: 'login' })
}

function switchToMember() {
    router.push({ name: 'member-dashboard' })
}
</script>

<template>
    <div class="min-h-screen flex bg-gray-50">
        <!-- Mobile overlay -->
        <div v-if="sidebarOpen" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            @click="sidebarOpen = false" />

        <!-- Sidebar -->
        <aside
            class="fixed lg:static inset-y-0 left-0 z-40 w-[272px] transform transition-transform duration-300 ease-out lg:translate-x-0 flex flex-col text-white"
            :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
            style="background: linear-gradient(180deg, #060e2a 0%, #091f55 100%);">
            <!-- Brand -->
            <div class="flex items-center gap-3.5 px-6 h-16 border-b border-white/[0.08]">
                <div class="w-9 h-9 rounded-xl bg-gold flex items-center justify-center shadow-lg shadow-gold/20">
                    <span class="text-navy font-heading font-extrabold text-sm tracking-tight">R</span>
                </div>
                <div class="leading-tight">
                    <span class="font-heading font-bold text-[15px] block">RCMI Admin</span>
                    <span class="text-[10px] text-white/30 font-medium uppercase tracking-[0.1em]">Management</span>
                </div>
            </div>

            <!-- Nav -->
            <nav class="flex-1 overflow-y-auto py-4 px-3">
                <div v-for="(group, gi) in navGroups" :key="group.title" :class="gi > 0 ? 'mt-6' : ''">
                    <p class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">{{
                        group.title }}</p>
                    <div class="space-y-1">
                        <router-link v-for="item in group.items" :key="item.label" :to="item.to"
                            class="group flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium text-white/50 hover:text-white/90 hover:bg-white/[0.07] transition-all duration-200"
                            active-class="!bg-white/[0.12] !text-gold" @click="sidebarOpen = false">
                            <svg class="w-5 h-5 shrink-0 transition-colors duration-200" fill="none"
                                stroke="currentColor" viewBox="0 0 24 24" v-html="icons[item.iconKey]" />
                            <span class="flex-1">{{ item.label }}</span>
                            <span v-if="item.badge" class="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                        </router-link>
                    </div>
                </div>
            </nav>

            <!-- User footer (sticky bottom) -->
            <div class="shrink-0 border-t border-white/8 px-3 py-3 relative">
                <!-- Switch to Member View -->
                <button @click="switchToMember"
                    class="flex items-center gap-3 w-full px-4 py-2.5 mb-2 text-sm text-white/60 hover:text-white hover:bg-white/6 rounded-2xl transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    Switch to Member
                </button>

                <!-- User menu popup -->
                <Transition enter-active-class="transition duration-150 ease-out"
                    enter-from-class="opacity-0 translate-y-2 scale-95"
                    enter-to-class="opacity-100 translate-y-0 scale-100"
                    leave-active-class="transition duration-100 ease-in"
                    leave-from-class="opacity-100 translate-y-0 scale-100"
                    leave-to-class="opacity-0 translate-y-2 scale-95">
                    <div v-if="showUserMenu"
                        class="absolute bottom-full left-3 right-3 mb-2 bg-[#0d1a3a] rounded-2xl border border-white/10 shadow-xl shadow-black/30 overflow-hidden">
                        <div class="px-4 py-3 border-b border-white/8">
                            <p class="text-xs text-white/40 truncate">{{ auth.user?.email }}</p>
                            <p class="text-[10px] text-gold/70 capitalize mt-0.5">{{ auth.roleType }}</p>
                        </div>
                        <div class="py-1.5">
                            <button @click="handleLogout"
                                class="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-white/4 transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                                Sign out
                            </button>
                        </div>
                    </div>
                </Transition>

                <!-- Avatar button -->
                <button @click="showUserMenu = !showUserMenu"
                    class="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl hover:bg-white/6 transition-colors text-left">
                    <div
                        class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-sm font-bold text-gold ring-1 ring-white/8">
                        {{ auth.user?.first_name?.[0] }}{{ auth.user?.last_name?.[0] }}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate text-white/90">{{ auth.user?.first_name }} {{
                            auth.user?.last_name }}</p>
                        <p class="text-xs text-white/30 capitalize truncate">{{ auth.roleType }}</p>
                    </div>
                    <svg class="w-4 h-4 text-white/30 shrink-0 transition-transform duration-200"
                        :class="showUserMenu ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </button>
            </div>

            <!-- Click-outside overlay to close menu -->
            <div v-if="showUserMenu" class="fixed inset-0 z-[-1]" @click="showUserMenu = false" />
        </aside>

        <!-- Main content -->
        <div class="flex-1 flex flex-col min-w-0">
            <!-- Topbar -->
            <header
                class="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 px-4 lg:px-6 h-14 flex items-center gap-4">
                <button class="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                    @click="sidebarOpen = !sidebarOpen">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <div class="flex-1" />
                <NotificationBell />
                <router-link :to="{ name: 'member-dashboard' }"
                    class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                            d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    <span class="hidden sm:inline">Member View</span>
                </router-link>
            </header>

            <!-- Page content -->
            <main class="flex-1 p-4 lg:p-6">
                <slot />
            </main>
        </div>
    </div>
</template>
