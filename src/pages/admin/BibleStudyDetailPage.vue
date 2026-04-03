<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAdminStore } from '@/stores/admin.store'

const props = defineProps<{ id: string }>()
const router = useRouter()
const admin = useAdminStore()

const study = ref<any>(null)
const churches = ref<any[]>([])
const handlers = ref<string[]>([])

const sessions = ref<any[]>([])
const loading = ref(true)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Session Management
const showSessionModal = ref(false)
const editingSession = ref<any>(null)
const sessionForm = ref({ session_date: '', topic: '', notes: '' })
const sessionSaving = ref(false)

// Active Session View (Attendance)
const activeSessionId = ref<number | null>(null)
const attendanceLogs = ref<any[]>([])
const attendanceLoading = ref(false)

// Log Attendance Add
const logTab = ref<'registered' | 'guest'>('registered')
const regMemberId = ref('')
const guestName = ref('')
const guestEmail = ref('')
const guestPhone = ref('')
const addingLog = ref(false)

// Member search for attendance
const memberSearch = ref('')
const showMemberDropdown = ref(false)
const availableMembers = computed(() => {
  const q = memberSearch.value.toLowerCase()
  const approved = admin.members.filter((m) => m.status === 'approved')
  if (!q) return approved.slice(0, 15)
  return approved
    .filter(
      (m) =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    )
    .slice(0, 15)
})

function selectMember(m: any) {
  regMemberId.value = m.user_id
  memberSearch.value = `${m.first_name} ${m.last_name}`
  showMemberDropdown.value = false
}

function hideMemberDropdown() {
  setTimeout(() => {
    showMemberDropdown.value = false
  }, 200)
}

onMounted(async () => {
  await Promise.all([fetchChurches(), admin.fetchMembers(), fetchStudyDetails()])
  loading.value = false
})

async function fetchChurches() {
  const { data } = await supabase.from('lib_satellite_churches').select('id, church_name')
  churches.value = data ?? []
}

async function fetchStudyDetails() {
  // 1. Fetch main profile
  const { data: sData } = await supabase
    .from('tbl_bible_studies')
    .select('*')
    .eq('id', props.id)
    .single()
  if (!sData) {
    router.push({ name: 'admin-bible-studies' })
    return
  }
  study.value = sData

  // 2. Fetch handlers
  const { data: hData } = await supabase
    .from('tbl_bible_study_handlers')
    .select('user_id')
    .eq('bible_study_id', props.id)
  handlers.value = (hData ?? []).map((h) => h.user_id)

  // 3. Fetch Sessions
  await fetchSessions()
}

async function fetchSessions() {
  const { data } = await supabase
    .from('tbl_bible_study_sessions')
    .select('*')
    .eq('bible_study_id', props.id)
    .order('session_date', { ascending: false })
  sessions.value = data ?? []
}

function getChurchName(id: number | null) {
  if (!id) return '—'
  return churches.value.find((c) => c.id === id)?.church_name ?? '—'
}

function getMemberName(userId: string) {
  const m = admin.members.find((m) => m.user_id === userId)
  return m ? `${m.first_name} ${m.last_name}` : 'Unknown'
}

const handlerNames = computed(() => {
  if (!handlers.value.length) return '—'
  return handlers.value.map((uid) => getMemberName(uid)).join(', ')
})

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(time: string) {
  if (!time) return ''
  const parts = time.split(':')
  const h = parts[0]
  const m = parts[1] || '00'
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

// -- Session Handlers --
function openAddSession() {
  editingSession.value = null
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  sessionForm.value = { session_date: today, topic: '', notes: '' }
  showSessionModal.value = true
}

function openEditSession(s: any) {
  editingSession.value = s
  sessionForm.value = { session_date: s.session_date, topic: s.topic ?? '', notes: s.notes ?? '' }
  showSessionModal.value = true
}

async function handleSaveSession() {
  if (!sessionForm.value.session_date) return
  sessionSaving.value = true
  message.value = null

  const payload = {
    bible_study_id: props.id,
    session_date: sessionForm.value.session_date,
    topic: sessionForm.value.topic.trim() || null,
    notes: sessionForm.value.notes.trim() || null,
  }

  if (editingSession.value) {
    const { error } = await supabase
      .from('tbl_bible_study_sessions')
      .update(payload)
      .eq('id', editingSession.value.id)
    if (error) message.value = { type: 'error', text: error.message }
    else {
      message.value = { type: 'success', text: 'Session updated.' }
      showSessionModal.value = false
    }
  } else {
    const { error } = await supabase.from('tbl_bible_study_sessions').insert(payload)
    if (error) message.value = { type: 'error', text: error.message }
    else {
      message.value = { type: 'success', text: 'Session created.' }
      showSessionModal.value = false
    }
  }

  sessionSaving.value = false
  await fetchSessions()
}

async function removeSession(id: number) {
  if (!confirm('Are you sure you want to delete this session? All attendance logs will be lost.'))
    return
  const { error } = await supabase.from('tbl_bible_study_sessions').delete().eq('id', id)
  if (error) alert(error.message)
  else await fetchSessions()
}

// -- Attendance Handlers --
const activeSession = computed(
  () => sessions.value.find((s) => s.id === activeSessionId.value) || null,
)

async function viewAttendance(s: any) {
  activeSessionId.value = s.id
  message.value = null
  await fetchAttendance()
}

function backToSessions() {
  activeSessionId.value = null
  attendanceLogs.value = []
}

async function fetchAttendance() {
  if (!activeSessionId.value) return
  attendanceLoading.value = true
  const { data } = await supabase
    .from('tbl_bible_study_attendance')
    .select('*')
    .eq('session_id', activeSessionId.value)
    .order('logged_at', { ascending: false })

  attendanceLogs.value = data ?? []
  attendanceLoading.value = false
}

async function logAttendance() {
  if (!activeSessionId.value) return
  if (logTab.value === 'registered' && !regMemberId.value) return
  if (logTab.value === 'guest' && !guestName.value.trim()) return

  addingLog.value = true
  message.value = null

  // Check if already registered member
  if (logTab.value === 'registered') {
    const exists = attendanceLogs.value.find((a) => a.user_id === regMemberId.value)
    if (exists) {
      message.value = { type: 'error', text: 'Member is already logged in for this session.' }
      addingLog.value = false
      return
    }
  }

  const payload = {
    session_id: activeSessionId.value,
    user_id: logTab.value === 'registered' ? regMemberId.value : null,
    guest_name: logTab.value === 'guest' ? guestName.value.trim() : null,
    guest_email: logTab.value === 'guest' ? guestEmail.value.trim() : null,
    guest_contact: logTab.value === 'guest' ? guestPhone.value.trim() : null,
  }

  const { error } = await supabase.from('tbl_bible_study_attendance').insert(payload)

  if (error) {
    message.value = { type: 'error', text: error.message }
  } else {
    message.value = { type: 'success', text: 'Attendance logged.' }
    regMemberId.value = ''
    memberSearch.value = ''
    guestName.value = ''
    guestEmail.value = ''
    guestPhone.value = ''
    await fetchAttendance()
  }

  addingLog.value = false
}

async function removeAttendance(id: number) {
  if (!confirm('Remove this person from attendance?')) return
  const { error } = await supabase.from('tbl_bible_study_attendance').delete().eq('id', id)
  if (error) alert(error.message)
  else await fetchAttendance()
}
</script>

<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div class="h-24 bg-gray-200 rounded-lg animate-pulse" />
      <div class="h-64 bg-gray-200 rounded-lg animate-pulse" />
    </div>

    <template v-else-if="study">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button
          class="p-2 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-full transition-colors"
          @click="activeSessionId ? backToSessions() : router.push({ name: 'admin-bible-studies' })"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div>
          <h1 class="text-2xl font-heading font-bold text-navy">
            {{ activeSessionId ? 'Session Attendance' : study.title }}
          </h1>
          <div
            v-if="!activeSessionId"
            class="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-1 items-center"
          >
            <span>{{ getChurchName(study.satellite_church_id) }}</span>
            <span class="text-gray-300">•</span>
            <span>{{ study.location ?? 'No location set' }}</span>
            <span class="text-gray-300">•</span>
            <span
              v-if="!study.schedules || study.schedules.length === 0"
              class="italic text-gray-400"
              >No schedules set</span
            >
            <div v-else class="flex gap-1.5 flex-wrap">
              <span
                v-for="(sch, idx) in study.schedules"
                :key="idx"
                class="inline-flex gap-1 bg-navy/5 border border-navy/10 px-2 py-0.5 rounded shadow-sm text-xs items-center"
              >
                <span class="font-semibold text-navy">{{ formatDay(sch.day) }}</span>
                <span v-if="sch.time" class="text-gray-500 font-medium">{{
                  formatTime(sch.time)
                }}</span>
              </span>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500">
            {{ formatDate(activeSession?.session_date) }} •
            {{ activeSession?.topic || 'No topic specified' }}
          </p>
        </div>
      </div>

      <!-- Profile Overview (Only show if not in a specific session) -->
      <div v-if="!activeSessionId" class="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Handling Teachers / Leaders
        </h2>
        <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
          {{ handlerNames }}
        </p>
      </div>

      <p
        v-if="message"
        class="text-sm rounded-lg px-4 py-2 mb-4"
        :class="
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        "
      >
        {{ message.text }}
      </p>

      <!-- SESSIONS LIST VIEW -->
      <div
        v-if="!activeSessionId"
        class="bg-white rounded-lg border border-gray-200 overflow-hidden"
      >
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 class="font-heading font-semibold text-navy text-base">Study Sessions</h2>
          <button
            class="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-700"
            @click="openAddSession"
          >
            + Next Session
          </button>
        </div>
        <div v-if="!sessions.length" class="text-center py-8 text-gray-400 text-sm">
          No sessions recorded yet. Start one!
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="p-4 hover:bg-gray-50 flex items-center justify-between gap-4"
          >
            <div>
              <p class="font-medium text-gray-900">{{ formatDate(s.session_date) }}</p>
              <p class="text-xs text-gray-500">{{ s.topic || 'Untitled Session' }}</p>
            </div>
            <div class="flex items-center gap-3">
              <button class="text-xs text-navy hover:underline" @click="viewAttendance(s)">
                Log Attendance
              </button>
              <button class="text-xs text-gray-500 hover:text-navy" @click="openEditSession(s)">
                Edit
              </button>
              <button class="text-xs text-red-500 hover:text-red-700" @click="removeSession(s.id)">
                Del
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ATTENDANCE MANAGEMENT VIEW -->
      <div v-if="activeSessionId" class="grid lg:grid-cols-3 gap-6">
        <!-- Log Form Column -->
        <div class="bg-white rounded-lg border border-gray-200 p-5 h-fit">
          <h2 class="font-heading font-semibold text-navy text-base mb-4">Log Attendee</h2>

          <div class="flex gap-1 mb-4 bg-gray-100 rounded-md p-0.5">
            <button
              class="flex-1 py-1 text-xs font-medium rounded transition-colors"
              :class="
                logTab === 'registered'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
              @click="logTab = 'registered'; message = null"
            >
              Registered
            </button>
            <button
              class="flex-1 py-1 text-xs font-medium rounded transition-colors"
              :class="
                logTab === 'guest'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              "
              @click="logTab = 'guest'; message = null"
            >
              Guest
            </button>
          </div>

          <form @submit.prevent="logAttendance" class="space-y-4">
            <div v-if="logTab === 'registered'" class="relative">
              <label class="block text-xs font-medium text-gray-500 mb-1">Select Portal Member</label>
              <input
                v-model="memberSearch"
                type="text"
                placeholder="Search by name or email..."
                @focus="showMemberDropdown = true"
                @blur="hideMemberDropdown"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-navy/30"
              />

              <!-- Search Dropdown -->
              <div
                v-if="showMemberDropdown"
                class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                <div
                  v-for="m in availableMembers"
                  :key="m.user_id"
                  @mousedown="selectMember(m)"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <div
                    class="w-8 h-8 rounded-full overflow-hidden bg-navy/5 flex items-center justify-center shrink-0"
                  >
                    <img
                      v-if="m.profile_photo_url"
                      :src="m.profile_photo_url"
                      class="w-full h-full object-cover"
                    />
                    <span v-else class="text-[10px] font-bold text-navy">
                      {{ m.first_name?.[0] }}{{ m.last_name?.[0] }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-semibold text-gray-900 truncate">
                      {{ m.first_name }} {{ m.last_name }}
                    </p>
                    <p class="text-[10px] text-gray-400 truncate">{{ m.email }}</p>
                  </div>
                </div>
                <div v-if="!availableMembers.length" class="px-3 py-4 text-center text-xs text-gray-400">
                  No members found.
                </div>
              </div>
            </div>
            <div v-else class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Guest Full Name</label>
                <input
                  v-model="guestName"
                  type="text"
                  placeholder="e.g. John Doe"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy/30"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Email (Optional)</label>
                  <input
                    v-model="guestEmail"
                    type="email"
                    placeholder="john@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy/30"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1"
                    >Phone (Optional)</label
                  >
                  <input
                    v-model="guestPhone"
                    type="text"
                    placeholder="0917..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy/30"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              :disabled="
                addingLog ||
                (logTab === 'registered' && !regMemberId) ||
                (logTab === 'guest' && !guestName.trim())
              "
              class="w-full py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-50"
            >
              {{ addingLog ? 'Logging...' : '+ Add to Attendance' }}
            </button>
          </form>
        </div>

        <!-- Log List Column -->
        <div class="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="font-heading font-semibold text-navy text-base">
              Attendees ({{ attendanceLogs.length }})
            </h2>
          </div>

          <div v-if="attendanceLoading" class="p-8 text-center text-gray-400">
            Loading attendees...
          </div>
          <div v-else-if="!attendanceLogs.length" class="p-8 text-center text-gray-400 text-sm">
            No one logged in yet.
          </div>

          <div v-else class="divide-y divide-gray-100 overflow-y-auto max-h-[500px]">
            <div
              v-for="a in attendanceLogs"
              :key="a.id"
              class="p-3 flex items-center justify-between hover:bg-gray-50"
            >

              <div class="flex items-center gap-4">
                <span class="text-xs text-gray-400">{{
                  new Date(a.logged_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}</span>
                <button
                  class="text-gray-400 hover:text-red-500 transition-colors"
                  @click="removeAttendance(a.id)"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Session Modal -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="showSessionModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              class="absolute inset-0 bg-black/40 backdrop-blur-sm"
              @click="showSessionModal = false"
            />
            <div class="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
              <h3 class="font-heading font-semibold text-navy text-lg mb-4">
                {{ editingSession ? 'Edit' : 'Schedule' }} Session
              </h3>
              <form @submit.prevent="handleSaveSession" class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    v-model="sessionForm.session_date"
                    required
                    type="date"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >Topic / Lesson (Optional)</label
                  >
                  <input
                    v-model="sessionForm.topic"
                    type="text"
                    placeholder="e.g. Genesis 1"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div class="flex gap-3 pt-2">
                  <button
                    type="button"
                    class="flex-1 py-2 text-sm text-gray-600 border rounded-lg"
                    @click="showSessionModal = false"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="sessionSaving"
                    class="flex-1 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700"
                  >
                    {{ sessionSaving ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </Teleport>
    </template>
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
