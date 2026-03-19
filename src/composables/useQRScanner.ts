import { ref, onBeforeUnmount } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'

export function useQRScanner(elementId: string) {
    const scannedToken = ref<string | null>(null)
    const scanning = ref(false)
    const error = ref<string | null>(null)

    let scanner: Html5Qrcode | null = null

    async function start() {
        if (scanning.value) return
        error.value = null
        scannedToken.value = null

        try {
            scanner = new Html5Qrcode(elementId)
            scanning.value = true

            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    scannedToken.value = decodedText
                    stop()
                },
                () => {
                    // ignore scan failures (no QR in frame)
                },
            )
        } catch (e: any) {
            error.value = e?.message ?? 'Failed to start camera'
            scanning.value = false
        }
    }

    async function stop() {
        if (scanner) {
            try {
                await scanner.stop()
                await scanner.clear()
            } catch {
                // scanner may already be stopped
            }
            scanner = null
        }
        scanning.value = false
    }

    function reset() {
        scannedToken.value = null
        error.value = null
    }

    onBeforeUnmount(stop)

    return { scannedToken, scanning, error, start, stop, reset }
}
