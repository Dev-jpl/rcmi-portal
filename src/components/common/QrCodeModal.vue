<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { useQR } from '@/composables/useQR'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const { qrDataUrl, loading } = useQR(() => auth.profile?.qr_token)
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
                <!-- Backdrop -->
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

                <!-- Modal -->
                <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 scale-95 translate-y-4"
                    enter-to-class="opacity-100 scale-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="opacity-100 scale-100 translate-y-0"
                    leave-to-class="opacity-0 scale-95 translate-y-4"
                >
                    <div v-if="open" class="relative bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 text-center">
                        <!-- Close button -->
                        <button
                            @click="emit('close')"
                            class="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h2 class="text-lg font-heading font-bold text-navy mb-4">My QR Code</h2>

                        <!-- Loading -->
                        <div v-if="loading" class="w-56 h-56 mx-auto bg-gray-100 rounded-xl animate-pulse" />

                        <!-- QR Code -->
                        <div v-else-if="qrDataUrl" class="flex justify-center mb-4">
                            <img :src="qrDataUrl" alt="QR Code" class="w-56 h-56 rounded-xl" />
                        </div>

                        <!-- No token -->
                        <div v-else class="w-56 h-56 mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                            <p class="text-sm text-gray-400 px-4">No QR token assigned yet.<br />Contact your admin.</p>
                        </div>

                        <!-- Member info -->
                        <p class="text-base font-heading font-semibold text-navy">
                            {{ auth.user?.first_name }} {{ auth.user?.last_name }}
                        </p>
                        <p class="text-xs text-gray-500 mt-0.5">
                            {{ auth.profile?.satellite_church_name ?? 'RCMI' }}
                        </p>

                        <p class="text-[11px] text-gray-300 mt-4">
                            Present this QR code for attendance scanning
                        </p>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
