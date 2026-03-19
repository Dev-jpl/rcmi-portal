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

const auth = useAuthStore()
const devotionals = ref<Devotional[]>([])
const reactions = ref<Map<string, ReactionCount[]>>(new Map())
const newContent = ref('')
const posting = ref(false)
const loading = ref(true)

let channel: RealtimeChannel | null = null

const REACTION_TYPES = [
    { type: 'amen', label: 'Amen', emoji: '🙏' },
    { type: 'like', label: 'Like', emoji: '❤️' },
    { type: 'inspire', label: 'Inspired', emoji: '✨' },
]

async function fetchDevotionals() {
    loading.value = true
    const { data } = await supabase
        .from('tbl_devotionals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

    devotionals.value = data ?? []
    if (devotionals.value.length) await fetchReactions()
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

function getReaction(devId: string, type: string): ReactionCount {
    const devReactions = reactions.value.get(devId)
    return devReactions?.find((r) => r.type === type) ?? { devotional_id: devId, type, count: 0, user_reacted: false }
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
                placeholder="Share a devotional thought, verse, or encouragement…"
                rows="3"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-none"
            />
            <div class="flex justify-end mt-2">
                <button
                    :disabled="!newContent.trim() || posting"
                    class="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors"
                    @click="post"
                >
                    {{ posting ? 'Posting…' : 'Post' }}
                </button>
            </div>
        </div>

        <!-- Feed -->
        <div v-if="loading" class="text-center py-8 text-gray-400">Loading devotionals…</div>

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

                <!-- Reactions -->
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
                </div>
            </div>
        </div>
    </div>
</template>
