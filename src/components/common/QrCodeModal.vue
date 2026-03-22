<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useQR } from '@/composables/useQR'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const { qrDataUrl, loading } = useQR(() => auth.profile?.qr_token)

const activeTab = ref<'show' | 'scan'>('show')
const scanResult = ref<string | null>(null)
const scanError = ref<string | null>(null)
const scanSuccess = ref<{ name: string } | null>(null)
const scanning = ref(false)

let scanner: Html5Qrcode | null = null

async function startScanner() {
    scanResult.value = null
    scanError.value = null
    scanSuccess.value = null
    scanning.value = true

    await nextTick()
    const el = document.getElementById('qr-reader')
    if (!el) { scanning.value = false; return }

    try {
        scanner = new Html5Qrcode('qr-reader')
        await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => {} // ignore scan errors (no match yet)
        )
    } catch (e: any) {
        scanError.value = e?.message ?? 'Could not access camera'
        scanning.value = false
    }
}

async function stopScanner() {
    if (scanner) {
        try { await scanner.stop() } catch {}
        try { scanner.clear() } catch {}
        scanner = null
    }
    scanning.value = false
}

async function onScanSuccess(decodedText: string) {
    await stopScanner()
    scanResult.value = decodedText

    // Look up member by qr_token
    const { data, error: err } = await supabase
        .from('tbl_users')
        .select('first_name, last_name')
        .eq('qr_token', decodedText)
        .single()

    if (err || !data) {
        scanError.value = 'Member not found for this QR code'
    } else {
        scanSuccess.value = { name: [data.first_name, data.last_name].filter(Boolean).join(' ') }
    }
}

// Stop scanner when tab changes or modal closes
watch(activeTab, () => { stopScanner() })
watch(() => props.open, (open) => {
    if (!open) {
        stopScanner()
        activeTab.value = 'show'
        scanResult.value = null
        scanError.value = null
        scanSuccess.value = null
    }
})

onBeforeUnmount(() => { stopScanner() })
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
                    <div v-if="open" class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
                        <!-- Close button -->
                        <button
                            @click="emit('close')"
                            class="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <!-- Tabs -->
                        <div class="inline-flex gap-0.5 bg-gray-100/80 rounded-md p-0.5 mb-5">
                            <button
                                v-for="tab in [{ key: 'show' as const, label: 'My QR' }, { key: 'scan' as const, label: 'Scan QR' }]"
                                :key="tab.key"
                                class="px-3 py-1 text-xs font-medium rounded transition-all"
                                :class="activeTab === tab.key ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                                @click="activeTab = tab.key"
                            >
                                {{ tab.label }}
                            </button>
                        </div>

                        <!-- Show QR Tab -->
                        <template v-if="activeTab === 'show'">
                            <!-- Loading -->
                            <div v-if="loading" class="w-full aspect-square mx-auto bg-gray-100 rounded-xl animate-pulse" />

                            <!-- QR Code -->
                            <div v-else-if="qrDataUrl" class="flex justify-center mb-4">
                                <img :src="qrDataUrl" alt="QR Code" class="w-full aspect-square rounded-xl" />
                            </div>

                            <!-- No token -->
                            <div v-else class="w-full aspect-square mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-4">
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
                        </template>

                        <!-- Scan QR Tab -->
                        <template v-else>
                            <!-- Scanner area -->
                            <div v-if="!scanResult" class="space-y-4">
                                <div id="qr-reader" class="w-full aspect-square mx-auto rounded-xl overflow-hidden bg-gray-900" />

                                <button
                                    v-if="!scanning"
                                    @click="startScanner"
                                    class="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy-700 transition-colors"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                    </svg>
                                    Start Camera
                                </button>

                                <p v-if="scanning" class="text-xs text-gray-400">Point camera at a QR code...</p>

                                <p v-if="scanError && !scanResult" class="text-xs text-red-500">{{ scanError }}</p>
                            </div>

                            <!-- Scan result -->
                            <div v-else class="space-y-4">
                                <!-- Success -->
                                <div v-if="scanSuccess" class="space-y-3">
                                    <div class="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                                        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <p class="text-base font-heading font-semibold text-navy">{{ scanSuccess.name }}</p>
                                    <p class="text-xs text-green-600 font-medium">Member found</p>
                                </div>

                                <!-- Not found -->
                                <div v-else-if="scanError" class="space-y-3">
                                    <div class="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                                        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <p class="text-xs text-red-500">{{ scanError }}</p>
                                </div>

                                <button
                                    @click="scanResult = null; scanError = null; scanSuccess = null"
                                    class="inline-flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy-700 transition-colors"
                                >
                                    Scan Again
                                </button>
                            </div>
                        </template>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* Force html5-qrcode video to fill container */
:deep(#qr-reader video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    border-radius: 0.75rem;
}
:deep(#qr-reader) {
    border: none !important;
}
:deep(#qr-reader__scan_region) {
    min-height: auto !important;
}
:deep(#qr-reader__dashboard) {
    display: none !important;
}
</style>
