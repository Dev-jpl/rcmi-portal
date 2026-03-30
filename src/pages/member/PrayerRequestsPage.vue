<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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

interface Comment {
    id: number
    parent_id: string
    user_id: string
    author_name: string
    content: string
    created_at: string
}

const auth = useAuthStore()
const activeTab = ref<'mine' | 'community'>('mine')
const requests = ref<PrayerRequest[]>([])
const communityRequests = ref<PrayerRequest[]>([])
const prayerCounts = ref<Map<string, PrayerCount>>(new Map())
const comments = ref<Map<string, Comment[]>>(new Map())
const newContent = ref('')
const isPublic = ref(false)
const posting = ref(false)
const loading = ref(true)

// Comment state
const commentInputs = ref<Map<string, string>>(new Map())
const commentPosting = ref<Set<string>>(new Set())
const expandedComments = ref<Set<string>>(new Set())

// Dropdown menu state
const openMenu = ref<string | null>(null)
const openCommentMenu = ref<number | null>(null)

function toggleMenu(id: string) {
    openMenu.value = openMenu.value === id ? null : id
}
function toggleCommentMenu(id: number) {
    openCommentMenu.value = openCommentMenu.value === id ? null : id
}
function closeMenus() {
    openMenu.value = null
    openCommentMenu.value = null
}

// Edit/Delete state
const editingRequest = ref<PrayerRequest | null>(null)
const editRequestContent = ref('')
const editRequestPublic = ref(false)
const editSaving = ref(false)
const editingComment = ref<Comment | null>(null)
const editCommentContent = ref('')
const editCommentSaving = ref(false)
const showDeleteConfirm = ref<{ type: 'request' | 'comment'; id: string | number } | null>(null)
const deleteProcessing = ref(false)

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
    if (communityRequests.value.length) {
        await Promise.all([fetchPrayerCounts(), fetchComments()])
    }
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

async function fetchComments() {
    const ids = communityRequests.value.map((r) => r.id)
    if (!ids.length) return

    const { data } = await supabase
        .from('tbl_comments')
        .select('*')
        .eq('parent_type', 'prayer')
        .in('parent_id', ids)
        .order('created_at', { ascending: true })

    const map = new Map<string, Comment[]>()
    for (const c of data ?? []) {
        const list = map.get(c.parent_id) ?? []
        list.push(c)
        map.set(c.parent_id, list)
    }
    comments.value = map
}

function getPrayerCount(id: string): PrayerCount {
    return prayerCounts.value.get(id) ?? { prayer_request_id: id, count: 0, user_prayed: false }
}

function getComments(id: string): Comment[] {
    return comments.value.get(id) ?? []
}

function getCommentCount(id: string): number {
    return getComments(id).length
}

function toggleComments(id: string) {
    if (expandedComments.value.has(id)) {
        expandedComments.value.delete(id)
    } else {
        expandedComments.value.add(id)
    }
}

function getCommentInput(id: string): string {
    return commentInputs.value.get(id) ?? ''
}

function setCommentInput(id: string, val: string) {
    commentInputs.value.set(id, val)
}

async function postComment(parentId: string) {
    const text = getCommentInput(parentId)?.trim()
    if (!text || !auth.session?.user) return

    commentPosting.value.add(parentId)
    const authorName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Member'

    await supabase.from('tbl_comments').insert({
        parent_type: 'prayer',
        parent_id: parentId,
        user_id: auth.session.user.id,
        author_name: authorName,
        content: text,
    })

    commentInputs.value.set(parentId, '')
    commentPosting.value.delete(parentId)
    expandedComments.value.add(parentId)
    await fetchComments()
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

// ── Edit/Delete prayer requests ──
function startEditRequest(r: PrayerRequest) {
    editingRequest.value = r
    editRequestContent.value = r.content
    editRequestPublic.value = r.is_public
}

function cancelEditRequest() {
    editingRequest.value = null
    editRequestContent.value = ''
}

async function saveEditRequest() {
    if (!editingRequest.value || !editRequestContent.value.trim()) return
    editSaving.value = true

    await supabase
        .from('tbl_prayer_requests')
        .update({ content: editRequestContent.value.trim(), is_public: editRequestPublic.value })
        .eq('id', editingRequest.value.id)

    editSaving.value = false
    cancelEditRequest()
    await fetchMyRequests()
    if (activeTab.value === 'community') await fetchCommunityRequests()
}

// ── Edit/Delete comments ──
function startEditComment(c: Comment) {
    editingComment.value = c
    editCommentContent.value = c.content
}

function cancelEditComment() {
    editingComment.value = null
    editCommentContent.value = ''
}

async function saveEditComment() {
    if (!editingComment.value || !editCommentContent.value.trim()) return
    editCommentSaving.value = true

    await supabase
        .from('tbl_comments')
        .update({ content: editCommentContent.value.trim() })
        .eq('id', editingComment.value.id)

    editCommentSaving.value = false
    cancelEditComment()
    await fetchComments()
}

// ── Delete confirm ──
async function confirmDelete() {
    if (!showDeleteConfirm.value) return
    deleteProcessing.value = true

    const { type, id } = showDeleteConfirm.value

    if (type === 'request') {
        await supabase.from('tbl_prayer_request_prayers').delete().eq('prayer_request_id', id)
        await supabase.from('tbl_comments').delete().eq('parent_type', 'prayer').eq('parent_id', String(id))
        await supabase.from('tbl_prayer_requests').delete().eq('id', id)
        await fetchMyRequests()
        if (activeTab.value === 'community') await fetchCommunityRequests()
    } else {
        await supabase.from('tbl_comments').delete().eq('id', id)
        await fetchComments()
    }

    deleteProcessing.value = false
    showDeleteConfirm.value = null
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

function timeAgo(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function handleClickOutside() {
    closeMenus()
}

onMounted(() => {
    fetchMyRequests()
    document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Prayer Requests</h1>

        <!-- Post form -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <textarea
                v-model="newContent"
                placeholder="Share your prayer request..."
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
                    {{ posting ? 'Submitting...' : 'Submit Request' }}
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
            <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

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
                        <div class="flex items-center gap-2">
                            <StatusBadge :status="req.status" />
                            <div class="relative">
                                <button class="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600" @click.stop="toggleMenu(req.id)">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                </button>
                                <Transition name="dropdown">
                                    <div v-if="openMenu === req.id" class="absolute right-0 top-8 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                        <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors" @click="startEditRequest(req); closeMenus()">
                                            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            Edit
                                        </button>
                                        <button class="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors" @click="showDeleteConfirm = { type: 'request', id: req.id }; closeMenus()">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            Delete
                                        </button>
                                    </div>
                                </Transition>
                            </div>
                        </div>
                    </div>
                    <!-- Edit mode -->
                    <div v-if="editingRequest?.id === req.id">
                        <textarea v-model="editRequestContent" rows="3" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none" />
                        <div class="flex items-center justify-between mt-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input v-model="editRequestPublic" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy" />
                                <span class="text-xs text-gray-500">Share with community</span>
                            </label>
                            <div class="flex gap-2">
                                <button class="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700" @click="cancelEditRequest">Cancel</button>
                                <button :disabled="editSaving || !editRequestContent.trim()" class="px-3 py-1.5 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors" @click="saveEditRequest">
                                    {{ editSaving ? 'Saving...' : 'Save' }}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p v-else class="text-sm text-gray-700 whitespace-pre-line">{{ req.content }}</p>
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

                    <!-- Pray + Comment toggle -->
                    <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                            :class="getPrayerCount(req.id).user_prayed
                                ? 'bg-navy/10 text-navy'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                            @click="togglePray(req.id)"
                        >
                            <span>&#x1F64F;</span>
                            <span v-if="getPrayerCount(req.id).count > 0">
                                {{ getPrayerCount(req.id).count }} praying
                            </span>
                            <span v-else>Pray for this</span>
                        </button>
                        <span class="flex-1" />
                        <button
                            class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            @click="toggleComments(req.id)"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                            </svg>
                            {{ getCommentCount(req.id) || 'Comment' }}
                        </button>
                    </div>

                    <!-- Comments Section -->
                    <div v-if="expandedComments.has(req.id)" class="mt-3 pt-3 border-t border-gray-100">
                        <div v-if="getComments(req.id).length" class="space-y-2.5 mb-3">
                            <div
                                v-for="c in getComments(req.id)"
                                :key="c.id"
                                class="flex gap-2.5"
                            >
                                <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 mt-0.5">
                                    {{ c.author_name?.[0] ?? '?' }}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <!-- Editing comment -->
                                    <div v-if="editingComment?.id === c.id" class="bg-gray-50 rounded-lg px-3 py-2">
                                        <input v-model="editCommentContent" type="text" class="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-navy/20" @keyup.enter="saveEditComment" />
                                        <div class="flex justify-end gap-2 mt-1.5">
                                            <button class="text-[10px] text-gray-400 hover:text-gray-600" @click="cancelEditComment">Cancel</button>
                                            <button :disabled="editCommentSaving" class="text-[10px] text-navy font-medium hover:underline" @click="saveEditComment">{{ editCommentSaving ? '...' : 'Save' }}</button>
                                        </div>
                                    </div>
                                    <!-- Normal display -->
                                    <template v-else>
                                        <div class="bg-gray-50 rounded-lg px-3 py-2">
                                            <p class="text-xs font-medium text-gray-900">{{ c.author_name }}</p>
                                            <p class="text-xs text-gray-600 whitespace-pre-line">{{ c.content }}</p>
                                        </div>
                                        <div class="flex items-center gap-2 mt-0.5 ml-1">
                                            <p class="text-[10px] text-gray-400">{{ timeAgo(c.created_at) }}</p>
                                            <div v-if="c.user_id === auth.session?.user?.id" class="relative">
                                                <button class="text-[10px] text-gray-400 hover:text-gray-600" @click.stop="toggleCommentMenu(c.id)">
                                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                </button>
                                                <Transition name="dropdown">
                                                    <div v-if="openCommentMenu === c.id" class="absolute left-0 top-4 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                                        <button class="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50" @click="startEditComment(c); closeMenus()">Edit</button>
                                                        <button class="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50" @click="showDeleteConfirm = { type: 'comment', id: c.id }; closeMenus()">Delete</button>
                                                    </div>
                                                </Transition>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>
                        </div>

                        <!-- Comment input -->
                        <div class="flex gap-2">
                            <div class="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center text-[10px] font-bold text-navy shrink-0 mt-1">
                                {{ (auth.user?.first_name?.[0] ?? '') + (auth.user?.last_name?.[0] ?? '') }}
                            </div>
                            <div class="flex-1 flex gap-2">
                                <input
                                    :value="getCommentInput(req.id)"
                                    @input="setCommentInput(req.id, ($event.target as HTMLInputElement).value)"
                                    @keyup.enter="postComment(req.id)"
                                    type="text"
                                    placeholder="Write a comment..."
                                    class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                                />
                                <button
                                    :disabled="!getCommentInput(req.id)?.trim() || commentPosting.has(req.id)"
                                    class="px-3 py-1.5 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors shrink-0"
                                    @click="postComment(req.id)"
                                >
                                    {{ commentPosting.has(req.id) ? '...' : 'Post' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- Delete Confirmation -->
        <Teleport to="body">
            <Transition name="fade">
                <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showDeleteConfirm = null" />
                    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
                        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 class="font-heading font-semibold text-gray-900 text-lg mb-2">Delete {{ showDeleteConfirm.type === 'request' ? 'Prayer Request' : 'Comment' }}?</h3>
                        <p class="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
                        <div class="flex gap-3">
                            <button class="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm" @click="showDeleteConfirm = null">Cancel</button>
                            <button :disabled="deleteProcessing" class="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm" @click="confirmDelete">
                                {{ deleteProcessing ? 'Deleting...' : 'Delete' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
.dropdown-enter-active {
    transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-leave-active {
    transition: opacity 0.1s ease, transform 0.1s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
}
</style>
