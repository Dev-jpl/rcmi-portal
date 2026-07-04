<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import type { Tables } from '@/types/database.types'

const auth = useAuthStore()

type Newcomer = Tables<'tbl_newcomers'>
type AccessCode = Tables<'tbl_newcomer_access_codes'>
interface Church { id: number; church_name: string }

const STATUSES = ['new', 'contacted', 'attending', 'dropped'] as const
const STATUS_LABEL: Record<string, string> = {
    new: 'New', contacted: 'Contacted', attending: 'Attending', dropped: 'Dropped',
}
const STATUS_CLASS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    attending: 'bg-green-100 text-green-700',
    dropped: 'bg-gray-100 text-gray-500',
}

const tab = ref<'list' | 'codes'>('list')
const loading = ref(true)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const newcomers = ref<Newcomer[]>([])
const codes = ref<AccessCode[]>([])
const churches = ref<Church[]>([])

// Leaders are pinned to their own church; admins may choose any.
const isAdmin = computed(() => auth.isAdmin)
const myChurchId = computed<number | null>(() => auth.profile?.satellite_church_id ?? null)

// ── Filters ──────────────────────────────────────────────────────────────
const search = ref('')
const statusFilter = ref('')
const churchFilter = ref<number | null>(null)

const filtered = computed(() => {
    let list = newcomers.value
    const q = search.value.toLowerCase().trim()
    if (q) list = list.filter(n =>
        `${n.first_name} ${n.last_name}`.toLowerCase().includes(q) ||
        n.email.toLowerCase().includes(q) ||
        n.contact_no.toLowerCase().includes(q))
    if (statusFilter.value) list = list.filter(n => n.status === statusFilter.value)
    if (churchFilter.value) list = list.filter(n => n.church_id === churchFilter.value)
    return list
})

function churchName(id: number | null) {
    if (!id) return '—'
    return churches.value.find(c => c.id === id)?.church_name ?? '—'
}

function fmtDate(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Fetch ────────────────────────────────────────────────────────────────
onMounted(async () => {
    await Promise.all([fetchNewcomers(), fetchCodes(), fetchChurches()])
    loading.value = false
})

async function fetchNewcomers() {
    const { data } = await supabase
        .from('tbl_newcomers')
        .select('*')
        .eq('is_deleted', false)
        .order('submitted_at', { ascending: false })
    newcomers.value = data ?? []
}

async function fetchCodes() {
    const { data } = await supabase
        .from('tbl_newcomer_access_codes')
        .select('*')
        .order('created_at', { ascending: false })
    codes.value = data ?? []
}

async function fetchChurches() {
    const { data } = await supabase
        .from('lib_satellite_churches').select('id, church_name')
        .eq('is_active', true).order('church_name')
    churches.value = (data as Church[]) ?? []
}

// ── Manual entry modal ───────────────────────────────────────────────────
const showEntry = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = ref({
    first_name: '', last_name: '', email: '', contact_no: '',
    church_id: null as number | null, status: 'new', notes: '',
})

function openAdd() {
    editingId.value = null
    form.value = {
        first_name: '', last_name: '', email: '', contact_no: '',
        church_id: isAdmin.value ? null : myChurchId.value, status: 'new', notes: '',
    }
    showEntry.value = true
}

function openEdit(n: Newcomer) {
    editingId.value = n.id
    form.value = {
        first_name: n.first_name, last_name: n.last_name, email: n.email,
        contact_no: n.contact_no, church_id: n.church_id, status: n.status,
        notes: n.notes ?? '',
    }
    showEntry.value = true
}

const canSaveEntry = computed(() =>
    form.value.first_name.trim() && form.value.last_name.trim() &&
    form.value.email.trim() && form.value.contact_no.trim() && form.value.church_id)

async function saveEntry() {
    if (!canSaveEntry.value) return
    saving.value = true
    message.value = null
    const payload = {
        first_name: form.value.first_name.trim(),
        last_name: form.value.last_name.trim(),
        email: form.value.email.trim().toLowerCase(),
        contact_no: form.value.contact_no.trim(),
        church_id: form.value.church_id,
        status: form.value.status,
        notes: form.value.notes.trim() || null,
    }

    let error
    if (editingId.value) {
        ({ error } = await supabase.from('tbl_newcomers').update(payload).eq('id', editingId.value))
    } else {
        ({ error } = await supabase.from('tbl_newcomers').insert({ ...payload, source: 'manual' }))
    }

    saving.value = false
    if (error) {
        message.value = { type: 'error', text: error.code === '23505'
            ? 'That email or contact number is already registered.'
            : error.message }
        return
    }
    message.value = { type: 'success', text: editingId.value ? 'Newcomer updated.' : 'Newcomer added.' }
    showEntry.value = false
    await fetchNewcomers()
}

async function updateStatus(n: Newcomer, status: string) {
    const prev = n.status
    n.status = status
    const { error } = await supabase.from('tbl_newcomers').update({ status }).eq('id', n.id)
    if (error) { n.status = prev; message.value = { type: 'error', text: error.message } }
}

async function softDelete(n: Newcomer) {
    if (!confirm(`Remove ${n.first_name} ${n.last_name} from the list?`)) return
    const { error } = await supabase.from('tbl_newcomers')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', n.id)
    if (error) { message.value = { type: 'error', text: error.message }; return }
    newcomers.value = newcomers.value.filter(x => x.id !== n.id)
    message.value = { type: 'success', text: 'Newcomer removed.' }
}

// ── QR code generation ───────────────────────────────────────────────────
const showGen = ref(false)
const generating = ref(false)
const genForm = ref({
    church_id: null as number | null,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date().toISOString().split('T')[0],
})

// Map of access-code id -> QR data URL for previews.
const qrCache = ref<Record<string, string>>({})

function openGen() {
    genForm.value = {
        church_id: isAdmin.value ? null : myChurchId.value,
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: new Date().toISOString().split('T')[0],
    }
    showGen.value = true
}

function welcomeUrl(code: string) {
    return `${window.location.origin}/welcome?code=${code}`
}

// Anchor the window to Philippine time (UTC+8, no DST): full days inclusive.
function manilaStart(date: string) { return `${date}T00:00:00+08:00` }
function manilaEnd(date: string) { return `${date}T23:59:59+08:00` }

const canGenerate = computed(() =>
    genForm.value.church_id && genForm.value.valid_from && genForm.value.valid_until &&
    genForm.value.valid_until >= genForm.value.valid_from)

async function generateCode() {
    if (!canGenerate.value) return
    generating.value = true
    message.value = null
    const { data, error } = await supabase.from('tbl_newcomer_access_codes').insert({
        church_id: genForm.value.church_id!,
        valid_from: manilaStart(genForm.value.valid_from),
        valid_until: manilaEnd(genForm.value.valid_until),
        created_by: auth.user?.id ?? null,
    }).select().single()
    generating.value = false
    if (error || !data) {
        message.value = { type: 'error', text: error?.message ?? 'Could not generate code.' }
        return
    }
    codes.value.unshift(data)
    await renderQr(data)
    showGen.value = false
    tab.value = 'codes'
    message.value = { type: 'success', text: 'QR code generated.' }
}

async function renderQr(code: AccessCode) {
    if (qrCache.value[code.id]) return
    qrCache.value[code.id] = await QRCode.toDataURL(welcomeUrl(code.code), {
        width: 320, margin: 2, color: { dark: '#0a1f44', light: '#ffffff' },
    })
}

async function toggleCode(code: AccessCode) {
    const next = !code.is_active
    const { error } = await supabase.from('tbl_newcomer_access_codes')
        .update({ is_active: next }).eq('id', code.id)
    if (error) { message.value = { type: 'error', text: error.message }; return }
    code.is_active = next
}

function codeStatus(c: AccessCode): { label: string; cls: string } {
    const now = Date.now()
    if (!c.is_active) return { label: 'Disabled', cls: 'bg-gray-100 text-gray-500' }
    if (now < new Date(c.valid_from).getTime()) return { label: 'Scheduled', cls: 'bg-amber-100 text-amber-700' }
    if (now > new Date(c.valid_until).getTime()) return { label: 'Expired', cls: 'bg-gray-100 text-gray-500' }
    return { label: 'Active', cls: 'bg-green-100 text-green-700' }
}

async function copyLink(code: AccessCode) {
    await navigator.clipboard.writeText(welcomeUrl(code.code))
    message.value = { type: 'success', text: 'Link copied to clipboard.' }
}

function downloadQr(code: AccessCode) {
    const url = qrCache.value[code.id]
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `welcome-${code.code}.png`
    a.click()
}

// Render QR previews for codes as the codes tab is shown.
async function ensureQrsRendered() {
    await Promise.all(codes.value.map(renderQr))
}
</script>

<template>
    <div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
                <h1 class="text-2xl font-heading font-bold text-navy">Newcomers</h1>
                <p class="text-sm text-gray-500 mt-1">First-timer follow-up list</p>
            </div>
            <div class="flex gap-2">
                <button class="inline-flex items-center gap-2 px-4 py-2.5 border border-navy/20 text-navy text-sm font-semibold rounded-lg hover:bg-navy/5 transition-colors" @click="openGen">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/></svg>
                    Generate QR
                </button>
                <button class="inline-flex items-center gap-2 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 transition-colors" @click="openAdd">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Add Newcomer
                </button>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 mb-5 border-b border-gray-200">
            <button class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
                :class="tab === 'list' ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'"
                @click="tab = 'list'">
                Follow-up list
            </button>
            <button class="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
                :class="tab === 'codes' ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'"
                @click="tab = 'codes'; ensureQrsRendered()">
                QR codes
            </button>
        </div>

        <p v-if="message" class="text-sm rounded-lg px-4 py-2 mb-4" :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">{{ message.text }}</p>

        <!-- ── FOLLOW-UP LIST TAB ─────────────────────────────────────────── -->
        <template v-if="tab === 'list'">
            <div class="flex flex-wrap gap-3 mb-4">
                <input v-model="search" type="text" placeholder="Search by name, email, contact..." class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy" />
                <select v-model="statusFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                    <option value="">All statuses</option>
                    <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
                </select>
                <select v-if="isAdmin" v-model="churchFilter" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                    <option :value="null">All churches</option>
                    <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                </select>
            </div>

            <div v-if="loading" class="space-y-3"><div v-for="i in 4" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" /></div>
            <div v-else-if="!filtered.length" class="text-center py-12 text-gray-400">No newcomers yet.</div>

            <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
                                <th class="px-4 py-3">Name</th>
                                <th class="px-4 py-3 hidden md:table-cell">Email</th>
                                <th class="px-4 py-3 hidden sm:table-cell">Contact</th>
                                <th class="px-4 py-3 hidden xl:table-cell">Church</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Source</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3 hidden lg:table-cell">Submitted</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            <tr v-for="n in filtered" :key="n.id" class="hover:bg-gray-50/50">
                                <td class="px-4 py-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">
                                            {{ (n.first_name?.[0] ?? '') + (n.last_name?.[0] ?? '') }}
                                        </div>
                                        <span class="font-medium text-gray-900">{{ n.first_name }} {{ n.last_name }}</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{{ n.email }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">{{ n.contact_no }}</td>
                                <td class="px-4 py-3 text-gray-500 hidden xl:table-cell">{{ churchName(n.church_id) }}</td>
                                <td class="px-4 py-3 hidden lg:table-cell">
                                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="n.source === 'qr_form' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                                        {{ n.source === 'qr_form' ? 'QR form' : 'Manual' }}
                                    </span>
                                </td>
                                <td class="px-4 py-3">
                                    <select :value="n.status" @change="updateStatus(n, ($event.target as HTMLSelectElement).value)"
                                        class="text-xs font-medium rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-navy/30 cursor-pointer" :class="STATUS_CLASS[n.status]">
                                        <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
                                    </select>
                                </td>
                                <td class="px-4 py-3 text-gray-500 hidden lg:table-cell">{{ fmtDate(n.submitted_at) }}</td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    <button class="text-navy hover:text-navy-600 text-sm font-medium mr-3" @click="openEdit(n)">Edit</button>
                                    <button class="text-red-500 hover:text-red-600 text-sm font-medium" @click="softDelete(n)">Remove</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- ── QR CODES TAB ───────────────────────────────────────────────── -->
        <template v-else>
            <div v-if="!codes.length" class="text-center py-12 text-gray-400">
                No QR codes yet. Click <span class="font-medium text-gray-600">Generate QR</span> to create one.
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div v-for="c in codes" :key="c.id" class="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <p class="font-semibold text-gray-900">{{ churchName(c.church_id) }}</p>
                            <p class="text-xs text-gray-400 mt-0.5">{{ fmtDate(c.valid_from) }} – {{ fmtDate(c.valid_until) }}</p>
                        </div>
                        <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="codeStatus(c).cls">{{ codeStatus(c).label }}</span>
                    </div>
                    <div class="flex justify-center bg-gray-50 rounded-lg p-3 mb-3">
                        <img v-if="qrCache[c.id]" :src="qrCache[c.id]" alt="QR code" class="w-40 h-40" />
                        <div v-else class="w-40 h-40 animate-pulse bg-gray-200 rounded" />
                    </div>
                    <p class="text-center text-xs font-mono tracking-wider text-gray-500 mb-3">{{ c.code }}</p>
                    <div class="mt-auto grid grid-cols-3 gap-2 text-xs font-medium">
                        <button class="px-2 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50" @click="copyLink(c)">Copy link</button>
                        <button class="px-2 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50" @click="downloadQr(c)">Download</button>
                        <button class="px-2 py-1.5 border rounded-lg" :class="c.is_active ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'" @click="toggleCode(c)">
                            {{ c.is_active ? 'Disable' : 'Enable' }}
                        </button>
                    </div>
                </div>
            </div>
        </template>

        <!-- ── MANUAL ENTRY MODAL ─────────────────────────────────────────── -->
        <Teleport to="body">
            <div v-if="showEntry" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showEntry = false">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-4">{{ editingId ? 'Edit' : 'Add' }} Newcomer</h3>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">First name</label>
                                <input v-model="form.first_name" type="text" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                                <input v-model="form.last_name" type="text" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input v-model="form.email" type="email" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Contact no.</label>
                            <input v-model="form.contact_no" type="tel" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                            <select v-if="isAdmin" v-model="form.church_id" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                <option :value="null">Select a church...</option>
                                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                            </select>
                            <input v-else :value="churchName(form.church_id)" type="text" readonly class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select v-model="form.status" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                <option v-for="s in STATUSES" :key="s" :value="s">{{ STATUS_LABEL[s] }}</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Notes <span class="text-gray-400 font-normal">(optional)</span></label>
                            <textarea v-model="form.notes" rows="2" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"></textarea>
                        </div>
                    </div>
                    <div class="flex gap-3 mt-6">
                        <button class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50" @click="showEntry = false">Cancel</button>
                        <button class="flex-1 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50" :disabled="!canSaveEntry || saving" @click="saveEntry">
                            {{ saving ? 'Saving...' : 'Save' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- ── GENERATE QR MODAL ──────────────────────────────────────────── -->
        <Teleport to="body">
            <div v-if="showGen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showGen = false">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                    <h3 class="text-lg font-heading font-bold text-navy mb-1">Generate Welcome QR</h3>
                    <p class="text-sm text-gray-500 mb-4">Newcomers who scan this can register themselves during the dates below.</p>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Church</label>
                            <select v-if="isAdmin" v-model="genForm.church_id" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
                                <option :value="null">Select a church...</option>
                                <option v-for="c in churches" :key="c.id" :value="c.id">{{ c.church_name }}</option>
                            </select>
                            <input v-else :value="churchName(genForm.church_id)" type="text" readonly class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Valid from</label>
                                <input v-model="genForm.valid_from" type="date" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Valid until</label>
                                <input v-model="genForm.valid_until" type="date" :min="genForm.valid_from" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                            </div>
                        </div>
                        <p class="text-xs text-gray-400">The form opens at the start of "valid from" and closes at the end of "valid until" (Philippine time).</p>
                    </div>
                    <div class="flex gap-3 mt-6">
                        <button class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50" @click="showGen = false">Cancel</button>
                        <button class="flex-1 px-4 py-2.5 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-600 disabled:opacity-50" :disabled="!canGenerate || generating" @click="generateCode">
                            {{ generating ? 'Generating...' : 'Generate' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
