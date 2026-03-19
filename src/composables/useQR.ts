import { ref, watch } from 'vue'
import QRCode from 'qrcode'

export function useQR(token: () => string | null | undefined) {
    const qrDataUrl = ref<string | null>(null)
    const loading = ref(false)

    async function generate() {
        const val = token()
        if (!val) {
            qrDataUrl.value = null
            return
        }
        loading.value = true
        try {
            qrDataUrl.value = await QRCode.toDataURL(val, {
                width: 300,
                margin: 2,
                color: { dark: '#091f55', light: '#ffffff' },
            })
        } catch {
            qrDataUrl.value = null
        }
        loading.value = false
    }

    watch(token, generate, { immediate: true })

    return { qrDataUrl, loading, generate }
}
