<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { supabase } from '@/lib/supabase'

const auth = useAuthStore()
const router = useRouter()

const step = ref(1) // 1 = personal info, 2 = account details

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const satelliteChurchId = ref<number | null>(null)
const showPassword = ref(false)
const agreeTerms = ref(false)
const showAgreementModal = ref(false)

const churches = ref<{ id: number; church_name: string }[]>([])
const loadingChurches = ref(true)

// Validation
const errors = ref<Record<string, string>>({})
const touched = ref<Record<string, boolean>>({})

onMounted(async () => {
  const { data } = await supabase
    .from('lib_satellite_churches')
    .select('id, church_name')
    .eq('is_active', true)
    .order('church_name')
  churches.value = data ?? []
  loadingChurches.value = false
})

function validate(field?: string) {
  const e: Record<string, string> = { ...errors.value }

  function check(key: string) {
    switch (key) {
      case 'firstName':
        if (!firstName.value.trim()) e.firstName = 'First name is required'
        else delete e.firstName
        break
      case 'lastName':
        if (!lastName.value.trim()) e.lastName = 'Last name is required'
        else delete e.lastName
        break
      case 'church':
        if (!satelliteChurchId.value) e.church = 'Please select your satellite church'
        else delete e.church
        break
      case 'email':
        if (!email.value) e.email = 'Email address is required'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))
          e.email = 'Please enter a valid email address'
        else delete e.email
        break
      case 'password':
        if (!password.value) e.password = 'Password is required'
        else if (password.value.length < 6) e.password = 'Password must be at least 6 characters'
        else delete e.password
        // re-validate confirm if touched
        if (touched.value.confirmPassword) {
          if (confirmPassword.value && confirmPassword.value !== password.value)
            e.confirmPassword = 'Passwords do not match'
          else if (confirmPassword.value === password.value) delete e.confirmPassword
        }
        break
      case 'confirmPassword':
        if (!confirmPassword.value) e.confirmPassword = 'Please confirm your password'
        else if (confirmPassword.value !== password.value)
          e.confirmPassword = 'Passwords do not match'
        else delete e.confirmPassword
        break
    }
  }

  if (field) {
    check(field)
  } else {
    const fields =
      step.value === 1
        ? ['firstName', 'lastName', 'church']
        : ['email', 'password', 'confirmPassword']
    fields.forEach(check)
  }

  errors.value = e
}

// Watch for live validation
watch(firstName, () => {
  if (touched.value.firstName) validate('firstName')
})
watch(lastName, () => {
  if (touched.value.lastName) validate('lastName')
})
watch(satelliteChurchId, () => {
  if (touched.value.church) validate('church')
})
watch(email, () => {
  if (touched.value.email) validate('email')
})
watch(password, () => {
  if (touched.value.password) validate('password')
})
watch(confirmPassword, () => {
  if (touched.value.confirmPassword) validate('confirmPassword')
})

const passwordStrength = computed(() => {
  const p = password.value
  if (!p) return { level: 0, label: '', color: '' }
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++

  if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-400' }
  if (score <= 3) return { level: 2, label: 'Fair', color: 'bg-amber-400' }
  if (score <= 4) return { level: 3, label: 'Good', color: 'bg-blue-400' }
  return { level: 4, label: 'Strong', color: 'bg-green-500' }
})

const step1Valid = computed(
  () =>
    firstName.value.trim() &&
    lastName.value.trim() &&
    satelliteChurchId.value &&
    !errors.value.firstName &&
    !errors.value.lastName &&
    !errors.value.church,
)

function goToStep2() {
  touched.value = { ...touched.value, firstName: true, lastName: true, church: true }
  validate()
  if (step1Valid.value) step.value = 2
}

// Friendly error messages
const friendlyError = computed(() => {
  if (!auth.error) return ''
  const e = auth.error.toLowerCase()
  if (
    e.includes('already registered') ||
    e.includes('already been registered') ||
    e.includes('unique')
  ) {
    return 'An account with this email already exists. Please sign in instead, or use a different email.'
  }
  if (e.includes('password')) {
    return 'Password does not meet the requirements. Please use at least 6 characters.'
  }
  if (e.includes('rate limit') || e.includes('too many')) {
    return 'Too many registration attempts. Please wait a few minutes before trying again.'
  }
  if (e.includes('network') || e.includes('fetch')) {
    return 'Unable to connect to the server. Please check your internet connection.'
  }
  return auth.error
})

async function handleRegister() {
  touched.value = {
    firstName: true,
    lastName: true,
    church: true,
    email: true,
    password: true,
    confirmPassword: true,
  }
  validate()

  if (Object.keys(errors.value).length > 0) return
  if (!agreeTerms.value) return

  auth.error = null
  const selectedChurch = churches.value.find((c) => c.id === satelliteChurchId.value)
  const result = await auth.register({
    email: email.value.trim(),
    password: password.value,
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    satelliteChurchId: satelliteChurchId.value!,
    satelliteChurchName: selectedChurch?.church_name,
  })

  if (result.success) {
    router.push({ name: 'member-dashboard' })
  }
}

function markTouched(field: string) {
  touched.value[field] = true
  validate(field)
}
</script>

<template>
  <div>
    <div class="text-center mb-7">
      <h2 class="text-2xl font-heading font-bold text-navy mb-1">Create your account</h2>
      <p class="text-sm text-gray-400">Join the RCMI community in just a few steps</p>
    </div>

    <!-- Step indicators -->
    <div class="flex items-center gap-3 mb-7">
      <div class="flex items-center gap-2 flex-1">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
          :class="step >= 1 ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400'"
        >
          <svg
            v-if="step > 1"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          <span v-else>1</span>
        </div>
        <span class="text-xs font-medium" :class="step >= 1 ? 'text-navy' : 'text-gray-400'"
          >Personal Info</span
        >
      </div>
      <div class="w-8 h-px bg-gray-200" />
      <div class="flex items-center gap-2 flex-1">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
          :class="step >= 2 ? 'bg-navy text-white' : 'bg-gray-100 text-gray-400'"
        >
          2
        </div>
        <span class="text-xs font-medium" :class="step >= 2 ? 'text-navy' : 'text-gray-400'"
          >Account</span
        >
      </div>
    </div>

    <form @submit.prevent="step === 1 ? goToStep2() : handleRegister()" novalidate>
      <!-- Step 1: Personal Info -->
      <div v-show="step === 1" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="firstName" class="block text-sm font-medium text-gray-700 mb-1.5"
              >First Name</label
            >
            <input
              id="firstName"
              v-model="firstName"
              type="text"
              required
              class="w-full px-3.5 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.firstName && errors.firstName
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              "
              placeholder="Juan"
              @blur="markTouched('firstName')"
            />
            <p v-if="touched.firstName && errors.firstName" class="text-xs text-red-500 mt-1">
              {{ errors.firstName }}
            </p>
          </div>
          <div>
            <label for="lastName" class="block text-sm font-medium text-gray-700 mb-1.5"
              >Last Name</label
            >
            <input
              id="lastName"
              v-model="lastName"
              type="text"
              required
              class="w-full px-3.5 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.lastName && errors.lastName
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              "
              placeholder="Dela Cruz"
              @blur="markTouched('lastName')"
            />
            <p v-if="touched.lastName && errors.lastName" class="text-xs text-red-500 mt-1">
              {{ errors.lastName }}
            </p>
          </div>
        </div>

        <div>
          <label for="church" class="block text-sm font-medium text-gray-700 mb-1.5"
            >Satellite Church</label
          >
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                class="w-4.5 h-4.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
                />
              </svg>
            </div>
            <select
              id="church"
              v-model="satelliteChurchId"
              required
              class="w-full pl-11 pr-3 py-3 border rounded-xl text-sm bg-gray-50/50 appearance-none focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.church && errors.church
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-200 hover:border-gray-300'
              "
              @blur="markTouched('church')"
              @change="markTouched('church')"
            >
              <option :value="null" disabled>
                {{ loadingChurches ? 'Loading churches...' : 'Select your satellite church' }}
              </option>
              <option v-for="church in churches" :key="church.id" :value="church.id">
                {{ church.church_name }}
              </option>
            </select>
          </div>
          <p v-if="touched.church && errors.church" class="text-xs text-red-500 mt-1">
            {{ errors.church }}
          </p>
          <p v-else class="text-xs text-gray-400 mt-1.5">Choose the church you regularly attend</p>
        </div>

        <button
          type="submit"
          class="w-full py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
        >
          Continue
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </button>
      </div>

      <!-- Step 2: Account Details -->
      <div v-show="step === 2" class="space-y-4">
        <!-- Email -->
        <div>
          <label for="reg-email" class="block text-sm font-medium text-gray-700 mb-1.5"
            >Email address</label
          >
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                class="w-4.5 h-4.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <input
              id="reg-email"
              v-model="email"
              type="email"
              autocomplete="email"
              class="w-full pl-11 pr-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.email && errors.email
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              "
              placeholder="you@example.com"
              @blur="markTouched('email')"
            />
          </div>
          <p v-if="touched.email && errors.email" class="text-xs text-red-500 mt-1">
            {{ errors.email }}
          </p>
          <p v-else class="text-xs text-gray-400 mt-1.5">You'll use this to sign in</p>
        </div>

        <!-- Password -->
        <div>
          <label for="reg-password" class="block text-sm font-medium text-gray-700 mb-1.5"
            >Password</label
          >
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                class="w-4.5 h-4.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <input
              id="reg-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full pl-11 pr-11 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.password && errors.password
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              "
              placeholder="At least 6 characters"
              @blur="markTouched('password')"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="!showPassword"
                class="w-4.5 h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <svg v-else class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
            </button>
          </div>
          <p v-if="touched.password && errors.password" class="text-xs text-red-500 mt-1">
            {{ errors.password }}
          </p>
          <!-- Password strength -->
          <div v-if="password && !errors.password" class="mt-2">
            <div class="flex items-center gap-2">
              <div class="flex-1 flex gap-1">
                <div
                  v-for="i in 4"
                  :key="i"
                  class="h-1 flex-1 rounded-full transition-colors"
                  :class="i <= passwordStrength.level ? passwordStrength.color : 'bg-gray-200'"
                />
              </div>
              <span
                class="text-[11px] font-medium"
                :class="{
                  'text-red-500': passwordStrength.level === 1,
                  'text-amber-500': passwordStrength.level === 2,
                  'text-blue-500': passwordStrength.level === 3,
                  'text-green-600': passwordStrength.level === 4,
                }"
                >{{ passwordStrength.label }}</span
              >
            </div>
          </div>
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="reg-confirm" class="block text-sm font-medium text-gray-700 mb-1.5"
            >Confirm Password</label
          >
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                class="w-4.5 h-4.5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <input
              id="reg-confirm"
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full pl-11 pr-3 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
              :class="
                touched.confirmPassword && errors.confirmPassword
                  ? 'border-red-300 bg-red-50/50'
                  : confirmPassword && confirmPassword === password
                    ? 'border-green-300 bg-green-50/30'
                    : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
              "
              placeholder="Re-enter your password"
              @blur="markTouched('confirmPassword')"
            />
          </div>
          <p
            v-if="touched.confirmPassword && errors.confirmPassword"
            class="text-xs text-red-500 mt-1"
          >
            {{ errors.confirmPassword }}
          </p>
          <p
            v-else-if="confirmPassword && confirmPassword === password"
            class="text-xs text-green-600 mt-1 flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
            Passwords match
          </p>
        </div>

        <!-- Terms -->
        <label class="flex items-start gap-2.5 cursor-pointer pt-1">
          <input
            v-model="agreeTerms"
            type="checkbox"
            class="w-4 h-4 rounded border-gray-300 text-navy focus:ring-navy mt-0.5"
          />
          <span class="text-xs text-gray-500 leading-relaxed">
            I agree to the
            <button
              type="button"
              class="text-navy font-semibold hover:underline"
              @click.prevent="showAgreementModal = true"
            >
              User Agreement
            </button>
            and understand that my account will be in a
            <strong>restricted view-only mode</strong> until a church administrator approves my
            access.
          </span>
        </label>

        <!-- Server Error -->
        <div
          v-if="friendlyError"
          class="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
        >
          <svg
            class="w-5 h-5 text-red-400 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <div>
            <p class="text-sm text-red-700 font-medium">Registration failed</p>
            <p class="text-xs text-red-600/80 mt-0.5">{{ friendlyError }}</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-1">
          <button
            type="button"
            class="px-5 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
            @click="step = 1"
          >
            Back
          </button>
          <button
            type="submit"
            :disabled="auth.loading || !agreeTerms"
            class="flex-1 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy/50 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            <svg v-if="auth.loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {{ auth.loading ? 'Creating account...' : 'Create Account' }}
          </button>
        </div>
      </div>
    </form>

    <div class="mt-7 pt-6 border-t border-gray-100 text-center">
      <p class="text-sm text-gray-400">
        Already have an account?
        <router-link
          :to="{ name: 'login' }"
          class="text-navy font-semibold hover:text-navy-600 transition-colors"
        >
          Sign in
        </router-link>
      </p>
    </div>
  </div>

  <!-- Agreement Modal -->
  <Teleport to="body">
    <div
      v-if="showAgreementModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="showAgreementModal = false"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-heading font-bold text-navy">Member User Agreement</h3>
          <button class="text-gray-400 hover:text-gray-600" @click="showAgreementModal = false">
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
        <div class="flex-1 overflow-y-auto pr-2 text-sm text-gray-600 space-y-4">
          <p>
            Welcome to the RCMI Portal. By registering an account, you agree to the following
            conditions regarding your access and data usage.
          </p>

          <h4 class="font-semibold tracking-tight text-gray-800">1. Account Verification</h4>
          <p>
            All newly created accounts undergo a mandatory verification process by a Church
            Administrator. To ensure the security of our community, full access is granted only to
            verified individuals.
          </p>

          <h4 class="font-semibold tracking-tight text-gray-800">
            2. View-Only Registration Access
          </h4>
          <p>
            Upon completing this registration form, you will be able to log in immediately. However,
            your account will temporarily remain in <strong>View-Only</strong> mode. You will be
            able to navigate the portal, read announcements, view resources, and browse scripture
            plans.
          </p>

          <h4 class="font-semibold tracking-tight text-gray-800">3. Restricted Features</h4>
          <p>While awaiting approval, you will <strong>not</strong> have permission to:</p>
          <ul class="list-disc pl-5 mt-2 space-y-1">
            <li>Create or share Devotional Wall posts.</li>
            <li>Submit new Prayer Requests.</li>
            <li>Edit or update your Member Profile data.</li>
          </ul>

          <h4 class="font-semibold tracking-tight text-gray-800">4. Community Guidelines</h4>
          <p>
            Once your account is approved, we ask that you engage respectfully. Any Devotional posts
            or Prayer Requests must align with church principles and values. Misuse of the platform
            may result in access suspension.
          </p>
        </div>
        <div class="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            class="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
            @click="showAgreementModal = false"
          >
            Cancel
          </button>
          <button
            class="px-5 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition"
            @click="showAgreementModal = false; agreeTerms = true"
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
