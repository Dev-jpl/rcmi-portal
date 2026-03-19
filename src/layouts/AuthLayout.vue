<script setup lang="ts">
</script>

<template>
    <div class="min-h-screen flex bg-navy-900">
        <!-- Left: Branding panel (hidden on mobile) -->
        <div class="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col items-center justify-center relative overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy to-navy-700" />
            <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 20% 50%, white 1px, transparent 1px); background-size: 28px 28px;" />
            <div class="relative z-10 px-12 text-center">
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gold shadow-xl shadow-gold/20 mb-8">
                    <span class="text-navy font-heading font-extrabold text-3xl">R</span>
                </div>
                <h1 class="text-3xl font-heading font-bold text-white mb-3">RCMI Portal</h1>
                <p class="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">
                    Reach &middot; Connect &middot; Mobilize &middot; Inspire
                </p>
                <div class="flex items-center justify-center gap-6 mt-12">
                    <div class="text-center">
                        <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                            <svg class="w-5 h-5 text-gold/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                        </div>
                        <p class="text-[11px] text-white/30 font-medium">Community</p>
                    </div>
                    <div class="text-center">
                        <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                            <svg class="w-5 h-5 text-gold/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </div>
                        <p class="text-[11px] text-white/30 font-medium">Events</p>
                    </div>
                    <div class="text-center">
                        <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center mx-auto mb-2">
                            <svg class="w-5 h-5 text-gold/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                        </div>
                        <p class="text-[11px] text-white/30 font-medium">Devotional</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right: Auth form -->
        <div class="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 bg-gray-50 lg:rounded-l-[2rem]">
            <!-- Mobile logo (only visible on mobile) -->
            <div class="lg:hidden mb-8 text-center">
                <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gold shadow-lg shadow-gold/20 mb-4">
                    <span class="text-navy font-heading font-extrabold text-xl">R</span>
                </div>
                <h1 class="text-xl font-heading font-bold text-navy">RCMI Portal</h1>
                <p class="text-gray-400 text-xs mt-1">Reach &middot; Connect &middot; Mobilize &middot; Inspire</p>
            </div>

            <!-- Card -->
            <div class="w-full max-w-md">
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-8">
                    <slot />
                </div>
                <p class="text-center text-[11px] text-gray-300 mt-6">
                    &copy; {{ new Date().getFullYear() }} RCMI Portal. All rights reserved.
                </p>
            </div>
        </div>
    </div>
</template>
