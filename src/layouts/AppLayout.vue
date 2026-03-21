<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import NotificationBell from '@/components/common/NotificationBell.vue'
import QrCodeModal from '@/components/common/QrCodeModal.vue'

const auth = useAuthStore()
const router = useRouter()
const sidebarOpen = ref(false)
const showUserMenu = ref(false)
const showQr = ref(false)

const icons = {
    dashboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"/>`,
    announcements: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"/>`,
    devotional: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>`,
    events: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>`,
    prayer: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>`,
    attendance: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    programs: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"/>`,
    directory: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>`,
}

interface NavItem {
    label: string
    to: { name: string }
    iconKey: keyof typeof icons
}

interface NavGroup {
    title: string
    items: NavItem[]
}

const navGroups: NavGroup[] = [
    {
        title: 'Overview',
        items: [
            { label: 'Dashboard', to: { name: 'member-dashboard' }, iconKey: 'dashboard' },
            { label: 'Announcements', to: { name: 'member-announcements' }, iconKey: 'announcements' },
        ],
    },
    {
        title: 'Community',
        items: [
            { label: 'Devotional Wall', to: { name: 'member-devotional' }, iconKey: 'devotional' },
            { label: 'Prayer Requests', to: { name: 'member-prayer-requests' }, iconKey: 'prayer' },
            { label: 'Directory', to: { name: 'member-directory' }, iconKey: 'directory' },
        ],
    },
    {
        title: 'My Church Life',
        items: [
            { label: 'Events', to: { name: 'member-events' }, iconKey: 'events' },
            { label: 'Attendance', to: { name: 'member-attendance' }, iconKey: 'attendance' },
            { label: 'Programs', to: { name: 'member-programs' }, iconKey: 'programs' },
        ],
    },
]

const switchTarget = computed(() => {
    if (auth.isAdmin) return { label: 'Switch to Admin', route: 'admin-dashboard' }
    if (auth.isPastor) return { label: 'Switch to Management', route: 'admin-my-team' }
    if (auth.isNetworkLeader) return { label: 'Switch to Management', route: 'admin-my-network' }
    if (auth.isLpathLeader) return { label: 'Switch to Management', route: 'admin-my-lpath' }
    return null
})

async function handleLogout() {
    await auth.logout()
    router.push({ name: 'login' })
}
</script>

<template>
    <div class="min-h-screen flex bg-gray-50">
        <!-- Mobile overlay -->
        <div
            v-if="sidebarOpen"
            class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            @click="sidebarOpen = false"
        />

        <!-- Sidebar -->
        <aside
            class="fixed inset-y-0 left-0 z-40 w-[272px] transform transition-transform duration-300 ease-out lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen flex flex-col bg-navy text-white"
            :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
        >
            <!-- Brand -->
            <div class="flex items-center gap-3.5 px-6 h-16 border-b border-white/[0.08]">
                <div class="w-9 h-9 rounded-xl bg-gold flex items-center justify-center shadow-lg shadow-gold/20">
                    <span class="text-navy font-heading font-extrabold text-sm tracking-tight">R</span>
                </div>
                <div class="leading-tight">
                    <span class="font-heading font-bold text-[15px] block">RCMI Portal</span>
                    <span class="text-[10px] text-white/40 font-medium uppercase tracking-[0.1em]">Member</span>
                </div>
            </div>

            <!-- Nav -->
            <nav class="flex-1 overflow-y-auto py-4 px-3">
                <div v-for="(group, gi) in navGroups" :key="group.title" :class="gi > 0 ? 'mt-6' : ''">
                    <p class="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/30">{{ group.title }}</p>
                    <div class="space-y-1">
                        <router-link
                            v-for="item in group.items"
                            :key="item.label"
                            :to="item.to"
                            class="group flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium text-white/50 hover:text-white/90 hover:bg-white/[0.07] transition-all duration-200"
                            active-class="!bg-white/[0.12] !text-gold"
                            @click="sidebarOpen = false"
                        >
                            <svg class="w-5 h-5 shrink-0 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="icons[item.iconKey]" />
                            {{ item.label }}
                        </router-link>
                    </div>
                </div>
            </nav>

            <!-- User footer (sticky bottom) -->
            <div class="shrink-0 border-t border-white/[0.08] px-3 py-3 relative">
                <!-- Switch to Admin/Management -->
                <router-link
                    v-if="switchTarget"
                    :to="{ name: switchTarget.route }"
                    class="flex items-center gap-3 w-full px-4 py-2.5 mb-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] rounded-2xl transition-colors"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    {{ switchTarget.label }}
                </router-link>

                <!-- User menu popup -->
                <Transition
                    enter-active-class="transition duration-150 ease-out"
                    enter-from-class="opacity-0 translate-y-2 scale-95"
                    enter-to-class="opacity-100 translate-y-0 scale-100"
                    leave-active-class="transition duration-100 ease-in"
                    leave-from-class="opacity-100 translate-y-0 scale-100"
                    leave-to-class="opacity-0 translate-y-2 scale-95"
                >
                    <div
                        v-if="showUserMenu"
                        class="absolute bottom-full left-3 right-3 mb-2 bg-[#0d1a3a] rounded-2xl border border-white/[0.1] shadow-xl shadow-black/30 overflow-hidden"
                    >
                        <div class="px-4 py-3 border-b border-white/[0.08]">
                            <p class="text-xs text-white/40 truncate">{{ auth.user?.email }}</p>
                        </div>
                        <div class="py-1.5">
                            <router-link
                                :to="{ name: 'member-profile' }"
                                class="flex items-center gap-3 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
                                @click="showUserMenu = false"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                                My Profile
                            </router-link>
                            <button
                                @click="handleLogout"
                                class="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                </svg>
                                Sign out
                            </button>
                        </div>
                    </div>
                </Transition>

                <!-- Avatar button -->
                <button
                    @click="showUserMenu = !showUserMenu"
                    class="flex items-center gap-3 w-full px-3 py-2.5 rounded-2xl hover:bg-white/[0.06] transition-colors text-left"
                >
                    <div class="w-10 h-10 rounded-2xl bg-white/[0.1] flex items-center justify-center text-sm font-bold text-gold ring-1 ring-white/[0.08]">
                        {{ auth.user?.first_name?.[0] }}{{ auth.user?.last_name?.[0] }}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium truncate text-white/90">{{ auth.user?.first_name }} {{ auth.user?.last_name }}</p>
                        <p class="text-xs text-white/30 truncate">Member</p>
                    </div>
                    <svg class="w-4 h-4 text-white/30 shrink-0 transition-transform duration-200" :class="showUserMenu ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                </button>
            </div>

            <!-- Click-outside overlay to close menu -->
            <div v-if="showUserMenu" class="fixed inset-0 z-[-1]" @click="showUserMenu = false" />
        </aside>

        <!-- Main content -->
        <div class="flex-1 flex flex-col min-w-0">
            <!-- Topbar -->
            <header class="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 px-4 lg:px-6 h-14 flex items-center gap-4">
                <button
                    class="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                    @click="sidebarOpen = !sidebarOpen"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <div class="flex-1" />
                <button @click="showQr = true" class="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-navy transition-colors" title="My QR Code">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                    </svg>
                </button>
                <NotificationBell />
                <router-link
                    :to="{ name: 'member-profile' }"
                    class="flex items-center gap-2 text-sm text-gray-500 hover:text-navy transition-colors"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <span class="hidden sm:inline">My Profile</span>
                </router-link>
            </header>

            <!-- Page content -->
            <main class="flex-1 p-4 lg:p-6">
                <slot />
            </main>
        </div>
    </div>

    <QrCodeModal :open="showQr" @close="showQr = false" />
</template>
