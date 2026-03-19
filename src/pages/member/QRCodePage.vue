<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import { useQR } from '@/composables/useQR'

const auth = useAuthStore()
const { qrDataUrl, loading } = useQR(() => auth.profile?.qr_token)
</script>

<template>
    <div class="flex flex-col items-center justify-center py-8">
        <div class="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm w-full">
            <h1 class="text-2xl font-heading font-bold text-navy mb-6">My QR Code</h1>

            <!-- Loading -->
            <div v-if="loading" class="w-64 h-64 mx-auto bg-gray-100 rounded-xl animate-pulse" />

            <!-- QR -->
            <div v-else-if="qrDataUrl" class="flex justify-center mb-6">
                <img :src="qrDataUrl" alt="QR Code" class="w-64 h-64 rounded-xl" />
            </div>

            <!-- No token -->
            <div v-else class="w-64 h-64 mx-auto bg-gray-50 rounded-xl flex items-center justify-center mb-6">
                <p class="text-sm text-gray-400">No QR token assigned yet.<br />Contact your admin.</p>
            </div>

            <!-- Member info -->
            <p class="text-lg font-heading font-semibold text-navy">
                {{ auth.user?.first_name }} {{ auth.user?.last_name }}
            </p>
            <p class="text-sm text-gray-500 mt-1">
                {{ auth.profile?.satellite_church_name ?? 'RCMI' }}
            </p>

            <p class="text-xs text-gray-400 mt-4">
                Present this QR code for attendance scanning
            </p>
        </div>
    </div>
</template>
