<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()
const admin = useAdminStore()

interface Church {
  id: number
  church_name: string
}

interface BibleStudy {
  id: number
  title: string
  satellite_church_id: number | null
  location: string | null
  schedules: { day: string; time: string }[] | null
  is_active: boolean
  created_at: string
}

interface Handler {
  bible_study_id: number
  user_id: string
}

const loading = ref(true)
const search = ref('')
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const churches = ref<Church[]>([])
const studies = ref<BibleStudy[]>([])
const handlersMap = ref<Map<number, string[]>>(new Map()) // study_id -> array of member names

const showModal = ref(false)
const editingStudy = ref<BibleStudy | null>(null)
const form = ref({
  title: '',
  satellite_church_id: null as number | null,
  location: '',
  schedules: [] as { day: string; time: string }[],
  is_active: true,
  handler_ids: [] as string[],
})
const saving = ref(false)
const handlerSearch = ref('')
const showHandlerDropdown = ref(false)

const showDeleteModal = ref(false)
const deleteTarget = ref<{ id: number; label: string } | null>(null)
const deleting = ref(false)

onMounted(async () => {
  await Promise.all([fetchChurches(), admin.fetchMembers(), fetchStudies()])
  loading.value = false
})

async function fetchChurches() {
  const { data } = await supabase
    .from('lib_satellite_churches')
    .select('id, church_name')
    .order('church_name')
  churches.value = data ?? []
}

async function fetchStudies() {
  const { data } = await supabase
    .from('tbl_bible_studies')
    .select('*')
    .order('created_at', { ascending: false })
  studies.value = (data ?? []) as BibleStudy[]

  if (studies.value.length > 0) {
    const { data: hData } = await supabase
      .from('tbl_bible_study_handlers')
      .select('*')
      .in(
        'bible_study_id',
        studies.value.map((s) => s.id),
      )

    const map = new Map<number, string[]>()
    for (const h of (hData ?? []) as Handler[]) {
      const list = map.get(h.bible_study_id) ?? []
      list.push(h.user_id)
      map.set(h.bible_study_id, list)
    }
    handlersMap.value = map
  } else {
    handlersMap.value = new Map()
  }
}

const filteredStudies = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return studies.value
  return studies.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.location?.toLowerCase().includes(q) ||
      getChurchName(s.satellite_church_id).toLowerCase().includes(q) ||
      getHandlerNames(s.id).toLowerCase().includes(q),
  )
})

function getChurchName(id: number | null) {
  if (!id) return '—'
  return churches.value.find((c) => c.id === id)?.church_name ?? '—'
}

function getMember(userId: string) {
  return admin.members.find((m: Record<string, any>) => m.user_id === userId)
}

function getMemberName(userId: string) {
  const m = getMember(userId)
  return m ? `${m.first_name} ${m.last_name}` : 'Unknown'
}

function getHandlerNames(studyId: number) {
  const ids = handlersMap.value.get(studyId) ?? []
  if (ids.length === 0) return '—'
  return ids.map((id) => getMemberName(id)).join(', ')
}

const availableHandlers = computed(() => {
  const q = handlerSearch.value.toLowerCase()
  const approved = admin.members.filter(
    (m: Record<string, any>) =>
      m.status === 'approved' && !form.value.handler_ids.includes(m.user_id),
  )

  if (!q) return approved.slice(0, 15) // Show top 15 suggestions if no search

  return approved
    .filter(
      (m: Record<string, any>) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)),
    )
    .slice(0, 15)
})

function hideDropdown() {
  setTimeout(() => {
    showHandlerDropdown.value = false
  }, 200)
}

function formatTime(time: string) {
  if (!time) return ''
  const [h, m] = time.split(':')
  const hh = parseInt(h as string, 10)
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatDay(day: string) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(
    day,
  )
    ? `Every ${day}`
    : day
}

function openAdd() {
  editingStudy.value = null
  form.value = {
    title: '',
    satellite_church_id: null,
    location: '',
    schedules: [],
    is_active: true,
    handler_ids: [],
  }
  showModal.value = true
}

function openEdit(study: BibleStudy) {
  editingStudy.value = study
  form.value = {
    title: study.title,
    satellite_church_id: study.satellite_church_id,
    location: study.location ?? '',
    schedules: (study.schedules || []).map((s: { day: string; time: string }) => ({
      day: s.day,
      time: s.time,
    })),
    is_active: study.is_active,
    handler_ids: [...(handlersMap.value.get(study.id) ?? [])],
  }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.title.trim()) return
  saving.value = true
  message.value = null

  const payload = {
    title: form.value.title.trim(),
    satellite_church_id: form.value.satellite_church_id,
    location: form.value.location.trim() || null,
    schedules: form.value.schedules,
    is_active: form.value.is_active,
  }

  let studyId = editingStudy.value?.id

  if (editingStudy.value) {
    const { error } = await supabase.from('tbl_bible_studies').update(payload).eq('id', studyId)
    if (error) {
      message.value = { type: 'error', text: error.message }
      saving.value = false
      return
    }
    // Delete existing handlers, we will re-insert
    await supabase.from('tbl_bible_study_handlers').delete().eq('bible_study_id', studyId)
  } else {
    const { data, error } = await supabase
      .from('tbl_bible_studies')
      .insert(payload)
      .select('id')
      .single()
    if (error) {
      message.value = { type: 'error', text: error.message }
      saving.value = false
      return
    }
    studyId = data.id
  }

  // Insert handlers
  if (studyId && form.value.handler_ids.length > 0) {
    const handlerPayload = form.value.handler_ids.map((uid) => ({
      bible_study_id: studyId,
      user_id: uid,
    }))
    await supabase.from('tbl_bible_study_handlers').insert(handlerPayload)
  }

  message.value = {
    type: 'success',
    text: editingStudy.value ? 'Bible Study updated.' : 'Bible Study created.',
  }
  saving.value = false
  showModal.value = false
  await fetchStudies()
}

function toggleHandlerSelection(userId: string) {
  const idx = form.value.handler_ids.indexOf(userId)
  if (idx >= 0) {
    form.value.handler_ids.splice(idx, 1)
  } else {
    form.value.handler_ids.push(userId)
  }
}

async function toggleActive(study: BibleStudy) {
  const { error } = await supabase
    .from('tbl_bible_studies')
    .update({ is_active: !study.is_active })
    .eq('id', study.id)
  if (error) {
    message.value = { type: 'error', text: error.message }
  } else {
    await fetchStudies()
  }
}

function openDelete(study: BibleStudy) {
  deleteTarget.value = { id: study.id, label: study.title }
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  message.value = null

  const { error } = await supabase
    .from('tbl_bible_studies')
    .delete()
    .eq('id', deleteTarget.value.id)
  if (error) {
    message.value = { type: 'error', text: error.message }
  } else {
    message.value = { type: 'success', text: 'Bible Study deleted.' }
    await fetchStudies()
  }

  deleting.value = false
  showDeleteModal.value = false
  deleteTarget.value = null
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <h1 class="text-2xl font-heading font-bold text-navy">Bible Studies</h1>
      <button
        v-if="['super_admin', 'admin', 'pastoral'].includes(auth.roleType ?? '')"
        class="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
        @click="openAdd"
      >
        + Register Bible Study
      </button>
    </div>

    <p
      v-if="message"
      class="text-sm rounded-lg px-4 py-2 mb-4"
      :class="message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'"
    >
      {{ message.text }}
    </p>

    <div class="mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search Bible Studies..."
        class="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
      />
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-14 bg-gray-200 rounded-lg animate-pulse" />
    </div>

    <div v-else-if="!filteredStudies.length" class="text-center py-12 text-gray-400">
      No Bible Studies found.
    </div>

    <div v-else class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-left text-gray-500 font-medium">
              <th class="px-4 py-3">Title</th>
              <th class="px-4 py-3">Church Under</th>
              <th class="px-4 py-3">Location</th>
              <th class="px-4 py-3">Schedule</th>
              <th class="px-4 py-3">Handled By</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="s in filteredStudies" :key="s.id" class="hover:bg-gray-50/50">
              <td class="px-4 py-3 font-medium text-gray-900">
                <button
                  class="hover:text-navy hover:underline text-left"
                  @click="router.push({ name: 'admin-bible-study-detail', params: { id: s.id } })"
                >
                  {{ s.title }}
                </button>
              </td>
              <td class="px-4 py-3 text-gray-500">
                {{ getChurchName(s.satellite_church_id) }}
              </td>
              <td class="px-4 py-3 text-gray-500">{{ s.location ?? '—' }}</td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1.5 min-w-[140px]">
                  <span
                    v-if="!s.schedules || s.schedules.length === 0"
                    class="text-xs text-gray-400 italic"
                    >No schedules set</span
                  >
                  <div
                    v-for="(sch, idx) in s.schedules"
                    :key="idx"
                    class="inline-flex flex-col bg-navy/5 border border-navy/10 px-2 py-1 rounded shadow-sm"
                  >
                    <span class="text-[11px] font-semibold text-navy tracking-tight leading-none">{{
                      formatDay(sch.day)
                    }}</span>
                    <span
                      v-if="sch.time"
                      class="text-[10px] text-gray-500 font-medium leading-tight mt-1 truncate"
                      >{{ formatTime(sch.time) }}</span
                    >
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-500 max-w-xs truncate" :title="getHandlerNames(s.id)">
                {{ getHandlerNames(s.id) }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="s.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ s.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <template v-if="['super_admin', 'admin', 'pastoral'].includes(auth.roleType ?? '')">
                  <div class="flex items-center justify-end gap-2">
                    <button class="text-xs text-navy hover:underline" @click="openEdit(s)">
                      Edit
                    </button>
                    <button
                      class="text-xs hover:underline"
                      :class="s.is_active ? 'text-red-500' : 'text-green-600'"
                      @click="toggleActive(s)"
                    >
                      {{ s.is_active ? 'Deactivate' : 'Activate' }}
                    </button>
                    <button class="text-xs text-red-500 hover:underline" @click="openDelete(s)">
                      Delete
                    </button>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showModal = false" />
          <div
            class="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
          >
            <div class="flex items-center justify-between mb-5">
              <h3 class="font-heading font-semibold text-navy text-lg">
                {{ editingStudy ? 'Edit Bible Study' : 'Register Bible Study' }}
              </h3>
              <button class="text-gray-400 hover:text-gray-600" @click="showModal = false">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form @submit.prevent="handleSave" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >Title / Group Name</label
                >
                <input
                  v-model="form.title"
                  required
                  type="text"
                  class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  placeholder="e.g. Friday Night Youth Group"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Church Under</label>
                <select
                  v-model="form.satellite_church_id"
                  class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  <option :value="null" disabled>Select Church</option>
                  <option v-for="c in churches" :key="c.id" :value="c.id">
                    {{ c.church_name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  v-model="form.location"
                  type="text"
                  class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  placeholder="e.g. 123 Main St., Hall B"
                />
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="block text-sm font-medium text-gray-700">Schedules</label>
                  <button
                    type="button"
                    class="text-xs text-navy font-semibold hover:underline"
                    @click="form.schedules.push({ day: 'Sunday', time: '' })"
                  >
                    + Add Schedule
                  </button>
                </div>

                <div
                  v-for="(sch, idx) in form.schedules"
                  :key="idx"
                  class="flex gap-2 items-center"
                >
                  <select
                    v-model="sch.day"
                    class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30"
                  >
                    <option value="Sunday">Sunday</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                  <input
                    v-model="sch.time"
                    type="time"
                    class="w-1/2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                  />
                  <button
                    type="button"
                    @click="form.schedules.splice(idx, 1)"
                    class="text-red-500 hover:text-red-700 p-1"
                    title="Remove schedule"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div v-if="form.schedules.length === 0" class="text-sm text-gray-400 italic py-2">
                  No schedules added.
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >Handled By (Select Members)</label
                >

                <!-- Selected Handlers -->
                <div class="flex flex-wrap gap-2 mb-3">
                  <div
                    v-for="uid in form.handler_ids"
                    :key="uid"
                    class="flex items-center gap-2 bg-navy/10 text-navy px-3 py-1.5 rounded-full text-sm font-medium"
                  >
                    <img
                      v-if="getMember(uid)?.profile_photo_url"
                      :src="getMember(uid)?.profile_photo_url"
                      class="w-5 h-5 rounded-full object-cover bg-gray-200"
                    />
                    <div
                      v-else
                      class="w-5 h-5 rounded-full bg-navy/20 flex items-center justify-center text-[10px] font-bold text-navy"
                    >
                      {{ getMember(uid)?.first_name?.[0] || '?' }}
                    </div>
                    {{ getMemberName(uid) }}
                    <button
                      type="button"
                      @click="toggleHandlerSelection(uid)"
                      class="hover:text-red-500 ml-1 focus:outline-none"
                    >
                      &times;
                    </button>
                  </div>
                </div>

                <!-- Search Input & Dropdown -->
                <div class="relative">
                  <input
                    v-model="handlerSearch"
                    type="text"
                    placeholder="Search by name or email..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 bg-white"
                    @focus="showHandlerDropdown = true"
                    @blur="hideDropdown"
                  />

                  <div
                    v-if="showHandlerDropdown && availableHandlers.length > 0"
                    class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="m in availableHandlers"
                      :key="m.user_id"
                      type="button"
                      @click="toggleHandlerSelection(m.user_id); handlerSearch = ''"
                      class="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-0"
                    >
                      <img
                        v-if="m.profile_photo_url"
                        :src="m.profile_photo_url"
                        class="w-8 h-8 rounded-full object-cover bg-gray-200"
                      />
                      <div
                        v-else
                        class="w-8 h-8 rounded-full bg-navy text-white flex flex-shrink-0 items-center justify-center text-xs font-bold"
                      >
                        {{ m.first_name?.[0] || '?' }}
                      </div>

                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">
                          {{ m.first_name }} {{ m.last_name }}
                        </p>
                        <p v-if="m.email" class="text-xs text-gray-500 truncate">{{ m.email }}</p>
                      </div>

                      <div
                        class="text-xs text-navy font-medium bg-navy/5 px-2 py-0.5 rounded uppercase tracking-wider"
                      >
                        Add
                      </div>
                    </button>

                    <div
                      v-if="handlerSearch && availableHandlers.length === 0"
                      class="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      No members found matching "{{ handlerSearch }}"
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 pt-2">
                <input
                  v-model="form.is_active"
                  type="checkbox"
                  id="study-active"
                  class="rounded border-gray-300 text-navy focus:ring-navy/30"
                />
                <label for="study-active" class="text-sm text-gray-700">Active</label>
              </div>
              <button
                type="submit"
                :disabled="saving"
                class="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
              >
                {{ saving ? 'Saving...' : editingStudy ? 'Update Profile' : 'Register Profile' }}
              </button>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/40 backdrop-blur-sm"
            @click="showDeleteModal = false"
          />
          <div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
            <div
              class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <svg
                class="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 class="font-heading font-semibold text-gray-900 text-lg mb-2">Confirm Delete</h3>
            <p class="text-sm text-gray-500 mb-6">
              Are you sure you want to delete <strong>{{ deleteTarget?.label }}</strong
              >? This will permanently remove all related sessions and attendance logs.
            </p>
            <div class="flex gap-3">
              <button
                class="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                @click="showDeleteModal = false"
              >
                Cancel
              </button>
              <button
                :disabled="deleting"
                class="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                @click="handleDelete"
              >
                {{ deleting ? 'Deleting...' : 'Delete' }}
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
</style>
