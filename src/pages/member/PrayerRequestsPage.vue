<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import StatusBadge from '@/components/common/StatusBadge.vue'

interface PrayerRequest {
    id: string
    user_id: string
    content: string
    status: string
    is_public: boolean
    author_name: string | null
    created_at: string
}

interface PrayerCount {
    prayer_request_id: string
    count: number
    user_prayed: boolean
}

const auth = useAuthStore()
const activeTab = ref<'mine' | 'community'>('mine')
const requests = ref<PrayerRequest[]>([])
const communityRequests = ref<PrayerRequest[]>([])
const prayerCounts = ref<Map<string, PrayerCount>>(new Map())
const newContent = ref('')
const isPublic = ref(false)
const posting = ref(false)
const loading = ref(true)

async function fetchMyRequests() {
    if (!auth.session?.user) return
    loading.value = true

    const { data } = await supabase
        .from('tbl_prayer_requests')
        .select('*')
        .eq('user_id', auth.session.user.id)
        .order('created_at', { ascending: false })

    requests.value = data ?? []
    loading.value = false
}

async function fetchCommunityRequests() {
    const { data } = await supabase
        .from('tbl_prayer_requests')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50)

    communityRequests.value = data ?? []
    if (communityRequests.value.length) await fetchPrayerCounts()
}

async function fetchPrayerCounts() {
    const ids = communityRequests.value.map((r) => r.id)
    if (!ids.length) return

    const { data } = await supabase
        .from('tbl_prayer_request_prayers')
        .select('prayer_request_id, user_id')
        .in('prayer_request_id', ids)

    const map = new Map<string, PrayerCount>()
    const userId = auth.session?.user?.id

    for (const id of ids) {
        const prayers = (data ?? []).filter((p) => p.prayer_request_id === id)
        map.set(id, {
            prayer_request_id: id,
            count: prayers.length,
            user_prayed: prayers.some((p) => p.user_id === userId),
        })
    }
    prayerCounts.value = map
}

function getPrayerCount(id: string): PrayerCount {
    return prayerCounts.value.get(id) ?? { prayer_request_id: id, count: 0, user_prayed: false }
}

async function togglePray(id: string) {
    if (!auth.session?.user) return

    const existing = getPrayerCount(id)

    if (existing.user_prayed) {
        await supabase
            .from('tbl_prayer_request_prayers')
            .delete()
            .eq('prayer_request_id', id)
            .eq('user_id', auth.session.user.id)
    } else {
        await supabase.from('tbl_prayer_request_prayers').insert({
            prayer_request_id: id,
            user_id: auth.session.user.id,
        })
    }

    await fetchPrayerCounts()
}

async function post() {
    if (!newContent.value.trim() || !auth.session?.user) return

    posting.value = true
    const authorName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Member'

    await supabase.from('tbl_prayer_requests').insert({
        user_id: auth.session.user.id,
        content: newContent.value.trim(),
        status: 'pending',
        is_public: isPublic.value,
        author_name: authorName,
    })

    newContent.value = ''
    isPublic.value = false
    posting.value = false
    await fetchMyRequests()
    if (activeTab.value === 'community') await fetchCommunityRequests()
}

function switchTab(tab: 'mine' | 'community') {
    activeTab.value = tab
    if (tab === 'community' && communityRequests.value.length === 0) {
        fetchCommunityRequests()
    }
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(fetchMyRequests)
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Prayer Requests</h1>

        <!-- Post form -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <textarea
                v-model="newContent"
                placeholder="Share your prayer request…"
                rows="3"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
            />
            <div class="flex items-center justify-between mt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input v-model="isPublic" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                    <span class="text-xs text-gray-500">Share with community</span>
                </label>
                <button
                    :disabled="!newContent.trim() || posting"
                    class="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors"
                    @click="post"
                >
                    {{ posting ? 'Submitting…' : 'Submit Request' }}
                </button>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                :class="activeTab === 'mine' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="switchTab('mine')"
            >
                My Requests
            </button>
            <button
                class="flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors"
                :class="activeTab === 'community' ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'"
                @click="switchTab('community')"
            >
                Community Wall
            </button>
        </div>

        <!-- My Requests -->
        <template v-if="activeTab === 'mine'">
            <div v-if="loading" class="text-center py-8 text-gray-400">Loading…</div>

            <div v-else-if="requests.length === 0" class="text-center py-8 text-gray-400">
                You haven't submitted any prayer requests yet.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="req in requests"
                    :key="req.id"
                    class="bg-white rounded-xl border border-gray-200 p-4"
                >
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <p class="text-xs text-gray-400">{{ formatDate(req.created_at) }}</p>
                            <span v-if="req.is_public" class="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Public</span>
                        </div>
                        <StatusBadge :status="req.status" />
                    </div>
                    <p class="text-sm text-gray-700 whitespace-pre-line">{{ req.content }}</p>
                </div>
            </div>
        </template>

        <!-- Community Wall -->
        <template v-if="activeTab === 'community'">
            <div v-if="communityRequests.length === 0" class="text-center py-8 text-gray-400">
                No public prayer requests yet.
            </div>

            <div v-else class="space-y-3">
                <div
                    v-for="req in communityRequests"
                    :key="req.id"
                    class="bg-white rounded-xl border border-gray-200 p-4"
                >
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-navy text-xs font-bold">
                            {{ req.author_name?.[0] ?? '?' }}
                        </div>
                        <div>
                            <p class="text-sm font-medium text-gray-900">{{ req.author_name ?? 'Anonymous' }}</p>
                            <p class="text-xs text-gray-400">{{ formatDate(req.created_at) }}</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-700 whitespace-pre-line mb-3">{{ req.content }}</p>
                    <button
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                        :class="getPrayerCount(req.id).user_prayed
                            ? 'bg-navy/10 text-navy'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                        @click="togglePray(req.id)"
                    >
                        <span>🙏</span>
                        <span v-if="getPrayerCount(req.id).count > 0">
                            {{ getPrayerCount(req.id).count }} praying
                        </span>
                        <span v-else>Pray for this</span>
                    </button>
                </div>
            </div>
        </template>
    </div>
</template>
