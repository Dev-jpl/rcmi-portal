<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'

// ── Honeypot toggle ──────────────────────────────────────────────────────
// Flip to `true` to re-enable the anti-bot honeypot field. While `false`, the
// hidden field is not rendered and an empty value is sent, so the server-side
// honeypot check never triggers. (The QR access-code + date window + per-IP
// rate limit still guard against spam regardless of this setting.)
const HONEYPOT_ENABLED = false

const route = useRoute()
const code = String(route.query.code ?? '')

type FormState = 'loading' | 'open' | 'not_open' | 'closed' | 'invalid' | 'done'
const state = ref<FormState>('loading')
const churchName = ref<string>('')
const gateMessage = ref<string>('')

const form = ref({ first_name: '', last_name: '', email: '', contact_no: '' })
const honeypot = ref('')            // bots fill this hidden field; humans never see it
const submitting = ref(false)
const errorMsg = ref('')

onMounted(async () => {
    if (!code) { state.value = 'invalid'; gateMessage.value = 'This link is not valid.'; return }
    const { data, error } = await supabase.rpc('get_welcome_form', { p_code: code })
    if (error) { state.value = 'invalid'; gateMessage.value = 'Something went wrong. Please try again.'; return }
    const res = data as { status: FormState; church_name?: string; message?: string }
    state.value = res.status
    churchName.value = res.church_name ?? ''
    gateMessage.value = res.message ?? ''
})

function valid() {
    return form.value.first_name.trim() && form.value.last_name.trim() &&
        form.value.email.trim() && form.value.contact_no.trim()
}

async function submit() {
    errorMsg.value = ''
    if (!valid()) { errorMsg.value = 'Please fill in all fields.'; return }
    submitting.value = true
    const { data, error } = await supabase.rpc('submit_newcomer', {
        p_code: code,
        p_first_name: form.value.first_name,
        p_last_name: form.value.last_name,
        p_email: form.value.email,
        p_contact_no: form.value.contact_no,
        p_honeypot: HONEYPOT_ENABLED ? honeypot.value : '',
    })
    submitting.value = false
    if (error) { errorMsg.value = 'Something went wrong. Please try again.'; return }
    const res = data as { ok: boolean; message: string }
    if (res.ok) { state.value = 'done'; gateMessage.value = res.message }
    else { errorMsg.value = res.message }
}
</script>

<template>
    <div class="text-center">
        <!-- Loading -->
        <div v-if="state === 'loading'" class="py-8">
            <div class="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin mx-auto" />
        </div>

        <!-- Success -->
        <div v-else-if="state === 'done'" class="py-4">
            <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
            <h2 class="text-xl font-heading font-bold text-navy mb-2">Welcome!</h2>
            <p class="text-sm text-gray-500">{{ gateMessage || 'Thank you for connecting with us. Someone from our team will reach out to you soon.' }}</p>
        </div>

        <!-- Gate: not open / closed / invalid -->
        <div v-else-if="state !== 'open'" class="py-4">
            <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
            </div>
            <h2 class="text-xl font-heading font-bold text-navy mb-2">
                {{ state === 'not_open' ? 'Not open yet' : 'Form closed' }}
            </h2>
            <p class="text-sm text-gray-500">{{ gateMessage }}</p>
        </div>

        <!-- Open: the form -->
        <div v-else class="text-left">
            <div class="text-center mb-6">
                <h2 class="text-xl font-heading font-bold text-navy">Welcome to {{ churchName }}!</h2>
                <p class="text-sm text-gray-500 mt-1">We'd love to get to know you. Please share your details.</p>
            </div>

            <!-- novalidate: let our own validation (and the server) handle errors, so a
                 quirky-but-real email can't have the browser silently block the submit. -->
            <form class="space-y-4" novalidate @submit.prevent="submit">
                <!-- Honeypot (only when HONEYPOT_ENABLED): display:none so browser/password-manager
                     autofill skips it — only naive bots fill it, which silently drops the submit. -->
                <div v-if="HONEYPOT_ENABLED" class="hidden" aria-hidden="true">
                    <label>Company (leave blank)
                        <input v-model="honeypot" type="text" tabindex="-1" autocomplete="off" name="company" />
                    </label>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">First name</label>
                        <input v-model="form.first_name" type="text" required class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input v-model="form.last_name" type="text" required class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input v-model="form.email" type="email" required class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Contact no.</label>
                    <input v-model="form.contact_no" type="tel" required class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                </div>

                <p v-if="errorMsg" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ errorMsg }}</p>

                <button type="submit" :disabled="submitting" class="w-full px-4 py-3 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50 transition-colors">
                    {{ submitting ? 'Submitting...' : 'Submit' }}
                </button>
            </form>
        </div>
    </div>
</template>
