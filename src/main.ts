import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/main.css'

import { useAuthStore } from './stores/auth.store'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Resolve session in background — guards will wait for resolved flag
useAuthStore().resolveSession()

app.mount('#app')
