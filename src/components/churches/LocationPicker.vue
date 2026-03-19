<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icon path issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
})

interface GeoResult {
    lat: number
    lng: number
    country?: string
    countryCode?: string
    region?: string
    province?: string
    municipality?: string
    barangay?: string
}

const props = defineProps<{
    latitude?: number | null
    longitude?: number | null
}>()

const emit = defineEmits<{
    (e: 'update', result: GeoResult): void
}>()

const mapContainer = ref<HTMLDivElement>()
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<{ display_name: string; lat: string; lon: string }[]>([])

let map: L.Map | null = null
let marker: L.Marker | null = null

const defaultCenter: L.LatLngExpression = [14.5995, 120.9842] // Manila
const defaultZoom = 6

onMounted(() => {
    if (!mapContainer.value) return

    const center: L.LatLngExpression =
        props.latitude && props.longitude
            ? [props.latitude, props.longitude]
            : defaultCenter

    const zoom = props.latitude && props.longitude ? 15 : defaultZoom

    map = L.map(mapContainer.value).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map)

    if (props.latitude && props.longitude) {
        marker = L.marker([props.latitude, props.longitude]).addTo(map)
    }

    map.on('click', async (e: L.LeafletMouseEvent) => {
        placeMarker(e.latlng.lat, e.latlng.lng)
        await reverseGeocode(e.latlng.lat, e.latlng.lng)
    })
})

onBeforeUnmount(() => {
    map?.remove()
})

watch(
    () => [props.latitude, props.longitude],
    ([lat, lng]) => {
        if (lat && lng && map) {
            placeMarker(lat, lng)
            map.setView([lat, lng], 15)
        }
    },
)

function placeMarker(lat: number, lng: number) {
    if (!map) return
    if (marker) {
        marker.setLatLng([lat, lng])
    } else {
        marker = L.marker([lat, lng]).addTo(map)
    }
}

async function searchLocation() {
    if (!searchQuery.value.trim()) return
    searching.value = true
    searchResults.value = []

    try {
        const params = new URLSearchParams({
            q: searchQuery.value,
            format: 'json',
            addressdetails: '1',
            limit: '5',
        })
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { 'Accept-Language': 'en' },
        })
        searchResults.value = await res.json()
    } catch {
        // Nominatim may be rate-limited
    } finally {
        searching.value = false
    }
}

async function selectSearchResult(result: { display_name: string; lat: string; lon: string }) {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    searchResults.value = []
    searchQuery.value = result.display_name

    if (map) {
        placeMarker(lat, lng)
        map.setView([lat, lng], 15)
    }

    await reverseGeocode(lat, lng)
}

async function reverseGeocode(lat: number, lng: number) {
    try {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lon: lng.toString(),
            format: 'json',
            addressdetails: '1',
        })
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
            headers: { 'Accept-Language': 'en' },
        })
        const data = await res.json()
        const addr = data.address || {}

        emit('update', {
            lat,
            lng,
            country: addr.country ?? null,
            countryCode: addr.country_code?.toUpperCase() ?? null,
            region: addr.state ?? addr.region ?? null,
            province: addr.state_district ?? addr.province ?? addr.county ?? null,
            municipality: addr.city ?? addr.town ?? addr.municipality ?? addr.city_district ?? null,
            barangay: addr.suburb ?? addr.village ?? addr.neighbourhood ?? null,
        })
    } catch {
        emit('update', { lat, lng })
    }
}
</script>

<template>
    <div class="space-y-3">
        <!-- Search bar -->
        <div class="relative">
            <div class="flex gap-2">
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search a location..."
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy"
                    @keydown.enter.prevent="searchLocation"
                />
                <button
                    type="button"
                    :disabled="searching"
                    class="px-4 py-2 bg-navy text-white text-sm font-medium rounded-lg hover:bg-navy-700 disabled:opacity-50 transition-colors"
                    @click="searchLocation"
                >
                    {{ searching ? '...' : 'Search' }}
                </button>
            </div>

            <!-- Search results dropdown -->
            <ul
                v-if="searchResults.length"
                class="absolute z-[1000] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
                <li
                    v-for="(r, i) in searchResults"
                    :key="i"
                    class="px-3 py-2 text-sm hover:bg-navy-50 cursor-pointer border-b border-gray-100 last:border-0"
                    @click="selectSearchResult(r)"
                >
                    {{ r.display_name }}
                </li>
            </ul>
        </div>

        <!-- Map -->
        <div
            ref="mapContainer"
            class="w-full h-72 rounded-lg border border-gray-300 z-0"
        />

        <p class="text-xs text-gray-400">Click on the map or search to set the location.</p>
    </div>
</template>
