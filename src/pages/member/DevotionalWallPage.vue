<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth.store'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Devotional {
    id: string
    user_id: string
    content: string
    author_name: string
    created_at: string
}

interface ReactionCount {
    devotional_id: string
    type: string
    count: number
    user_reacted: boolean
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
const devotionals = ref<Devotional[]>([])
const reactions = ref<Map<string, ReactionCount[]>>(new Map())
const comments = ref<Map<string, Comment[]>>(new Map())
const newContent = ref('')
const posting = ref(false)
const loading = ref(true)

// Comment state per devotional
const commentInputs = ref<Map<string, string>>(new Map())
const commentPosting = ref<Set<string>>(new Set())
const expandedComments = ref<Set<string>>(new Set())

let channel: RealtimeChannel | null = null

const REACTION_TYPES = [
    { type: 'amen', label: 'Amen', emoji: '\u{1F64F}' },
    { type: 'like', label: 'Like', emoji: '\u{2764}\u{FE0F}' },
    { type: 'inspire', label: 'Inspired', emoji: '\u{2728}' },
]

async function fetchDevotionals() {
    loading.value = true
    const { data } = await supabase
        .from('tbl_devotionals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

    devotionals.value = data ?? []
    if (devotionals.value.length) {
        await Promise.all([fetchReactions(), fetchComments()])
    }
    loading.value = false
}

async function fetchReactions() {
    const ids = devotionals.value.map((d) => d.id)
    if (!ids.length) return

    const { data } = await supabase
        .from('tbl_devotional_reactions')
        .select('devotional_id, type, user_id')
        .in('devotional_id', ids)

    const map = new Map<string, ReactionCount[]>()
    const userId = auth.session?.user?.id

    for (const id of ids) {
        const devReactions = (data ?? []).filter((r) => r.devotional_id === id)
        const counts: ReactionCount[] = REACTION_TYPES.map((rt) => {
            const matching = devReactions.filter((r) => r.type === rt.type)
            return {
                devotional_id: id,
                type: rt.type,
                count: matching.length,
                user_reacted: matching.some((r) => r.user_id === userId),
            }
        })
        map.set(id, counts)
    }
    reactions.value = map
}

async function fetchComments() {
    const ids = devotionals.value.map((d) => d.id)
    if (!ids.length) return

    const { data } = await supabase
        .from('tbl_comments')
        .select('*')
        .eq('parent_type', 'devotional')
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

function getReaction(devId: string, type: string): ReactionCount {
    const devReactions = reactions.value.get(devId)
    return devReactions?.find((r) => r.type === type) ?? { devotional_id: devId, type, count: 0, user_reacted: false }
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
        parent_type: 'devotional',
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

async function toggleReaction(devId: string, type: string) {
    if (!auth.session?.user) return

    const existing = getReaction(devId, type)

    if (existing.user_reacted) {
        await supabase
            .from('tbl_devotional_reactions')
            .delete()
            .eq('devotional_id', devId)
            .eq('user_id', auth.session.user.id)
            .eq('type', type)
    } else {
        await supabase.from('tbl_devotional_reactions').insert({
            devotional_id: devId,
            user_id: auth.session.user.id,
            type,
        })
    }

    await fetchReactions()
}

async function post() {
    if (!newContent.value.trim() || !auth.session?.user) return

    posting.value = true
    const authorName = [auth.user?.first_name, auth.user?.last_name].filter(Boolean).join(' ') || 'Member'

    await supabase.from('tbl_devotionals').insert({
        user_id: auth.session.user.id,
        content: newContent.value.trim(),
        author_name: authorName,
    })

    newContent.value = ''
    posting.value = false
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function timeAgo(d: string) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

onMounted(() => {
    fetchDevotionals()

    channel = supabase
        .channel('devotionals-realtime')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'tbl_devotionals' },
            (payload) => {
                devotionals.value.unshift(payload.new as Devotional)
            },
        )
        .subscribe()
})

onUnmounted(() => {
    if (channel) supabase.removeChannel(channel)
})
</script>

<template>
    <div class="max-w-2xl mx-auto">
        <h1 class="text-2xl font-heading font-bold text-navy mb-6">Devotional Wall</h1>

        <!-- Post form -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <textarea
                v-model="newContent"
                placeholder="Share a devotional thought, verse, or encouragement..."
                rows="3"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
            />
            <div class="flex justify-end mt-2">
                <button
                    :disabled="!newContent.trim() || posting"
                    class="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors"
                    @click="post"
                >
                    {{ posting ? 'Posting...' : 'Post' }}
                </button>
            </div>
        </div>

        <!-- Feed -->
        <div v-if="loading" class="text-center py-8 text-gray-400">Loading devotionals...</div>

        <div v-else-if="devotionals.length === 0" class="text-center py-8 text-gray-400">
            No devotionals yet. Be the first to share!
        </div>

        <div v-else class="space-y-4">
            <div
                v-for="item in devotionals"
                :key="item.id"
                class="bg-white rounded-xl border border-gray-200 p-4"
            >
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy text-xs font-bold">
                        {{ item.author_name?.[0] ?? '?' }}
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-900">{{ item.author_name }}</p>
                        <p class="text-xs text-gray-400">{{ formatDate(item.created_at) }}</p>
                    </div>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-line mb-3">{{ item.content }}</p>

                <!-- Reactions + Comment toggle -->
                <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                        v-for="rt in REACTION_TYPES"
                        :key="rt.type"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
                        :class="getReaction(item.id, rt.type).user_reacted
                            ? 'bg-navy/10 text-navy'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                        @click="toggleReaction(item.id, rt.type)"
                    >
                        <span>{{ rt.emoji }}</span>
                        <span v-if="getReaction(item.id, rt.type).count > 0">{{ getReaction(item.id, rt.type).count }}</span>
                        <span v-else>{{ rt.label }}</span>
                    </button>
                    <span class="flex-1" />
                    <button
                        class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        @click="toggleComments(item.id)"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                        </svg>
                        {{ getCommentCount(item.id) || 'Comment' }}
                    </button>
                </div>

                <!-- Comments Section -->
                <div v-if="expandedComments.has(item.id)" class="mt-3 pt-3 border-t border-gray-100">
                    <!-- Existing comments -->
                    <div v-if="getComments(item.id).length" class="space-y-2.5 mb-3">
                        <div
                            v-for="c in getComments(item.id)"
                            :key="c.id"
                            class="flex gap-2.5"
                        >
                            <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 mt-0.5">
                                {{ c.author_name?.[0] ?? '?' }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="bg-gray-50 rounded-lg px-3 py-2">
                                    <p class="text-xs font-medium text-gray-900">{{ c.author_name }}</p>
                                    <p class="text-xs text-gray-600 whitespace-pre-line">{{ c.content }}</p>
                                </div>
                                <p class="text-[10px] text-gray-400 mt-0.5 ml-1">{{ timeAgo(c.created_at) }}</p>
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
                                :value="getCommentInput(item.id)"
                                @input="setCommentInput(item.id, ($event.target as HTMLInputElement).value)"
                                @keyup.enter="postComment(item.id)"
                                type="text"
                                placeholder="Write a comment..."
                                class="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                            />
                            <button
                                :disabled="!getCommentInput(item.id)?.trim() || commentPosting.has(item.id)"
                                class="px-3 py-1.5 bg-navy text-white text-xs font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors shrink-0"
                                @click="postComment(item.id)"
                            >
                                {{ commentPosting.has(item.id) ? '...' : 'Post' }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
