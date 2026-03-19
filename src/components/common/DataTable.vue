<script setup lang="ts">
import { ref, computed } from 'vue'

export interface Column {
    key: string
    label: string
    sortable?: boolean
    class?: string
}

const props = withDefaults(
    defineProps<{
        columns: Column[]
        rows: Record<string, unknown>[]
        searchable?: boolean
        searchPlaceholder?: string
        pageSize?: number
    }>(),
    {
        searchable: true,
        searchPlaceholder: 'Search…',
        pageSize: 10,
    },
)

defineEmits<{
    (e: 'export'): void
}>()

const search = ref('')
const currentPage = ref(1)
const sortKey = ref('')
const sortAsc = ref(true)

const filtered = computed(() => {
    let data = [...props.rows]

    if (search.value) {
        const q = search.value.toLowerCase()
        data = data.filter((row) =>
            props.columns.some((col) =>
                String(row[col.key] ?? '')
                    .toLowerCase()
                    .includes(q),
            ),
        )
    }

    if (sortKey.value) {
        data.sort((a, b) => {
            const va = String(a[sortKey.value] ?? '')
            const vb = String(b[sortKey.value] ?? '')
            return sortAsc.value ? va.localeCompare(vb) : vb.localeCompare(va)
        })
    }

    return data
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / props.pageSize)))

const paged = computed(() => {
    const start = (currentPage.value - 1) * props.pageSize
    return filtered.value.slice(start, start + props.pageSize)
})

function toggleSort(key: string) {
    if (sortKey.value === key) {
        sortAsc.value = !sortAsc.value
    } else {
        sortKey.value = key
        sortAsc.value = true
    }
}

function onSearch() {
    currentPage.value = 1
}
</script>

<template>
    <div>
        <!-- Toolbar -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <input
                v-if="searchable"
                v-model="search"
                :placeholder="searchPlaceholder"
                class="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                @input="onSearch"
            />
            <div class="flex items-center gap-2">
                <slot name="actions" />
                <slot name="export">
                    <button
                        class="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        @click="$emit('export')"
                    >
                        Export
                    </button>
                </slot>
            </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 text-left">
                    <tr>
                        <th
                            v-for="col in columns"
                            :key="col.key"
                            class="px-4 py-3 font-medium text-gray-600 whitespace-nowrap"
                            :class="[col.class, col.sortable !== false ? 'cursor-pointer select-none hover:text-gray-900' : '']"
                            @click="col.sortable !== false && toggleSort(col.key)"
                        >
                            {{ col.label }}
                            <span v-if="sortKey === col.key" class="ml-1">{{ sortAsc ? '↑' : '↓' }}</span>
                        </th>
                        <th v-if="$slots.row-actions" class="px-4 py-3 font-medium text-gray-600">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                    <tr v-for="(row, i) in paged" :key="i" class="hover:bg-gray-50">
                        <td v-for="col in columns" :key="col.key" class="px-4 py-3" :class="col.class">
                            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                                {{ row[col.key] ?? '—' }}
                            </slot>
                        </td>
                        <td v-if="$slots['row-actions']" class="px-4 py-3">
                            <slot name="row-actions" :row="row" />
                        </td>
                    </tr>
                    <tr v-if="paged.length === 0">
                        <td :colspan="columns.length + ($slots['row-actions'] ? 1 : 0)" class="px-4 py-8 text-center text-gray-400">
                            No records found.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
                Showing {{ (currentPage - 1) * pageSize + 1 }}–{{
                    Math.min(currentPage * pageSize, filtered.length)
                }}
                of {{ filtered.length }}
            </span>
            <div class="flex items-center gap-1">
                <button
                    class="px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40"
                    :disabled="currentPage <= 1"
                    @click="currentPage--"
                >
                    Prev
                </button>
                <button
                    class="px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-40"
                    :disabled="currentPage >= totalPages"
                    @click="currentPage++"
                >
                    Next
                </button>
            </div>
        </div>
    </div>
</template>
