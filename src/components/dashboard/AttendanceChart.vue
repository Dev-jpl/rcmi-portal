<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{
    labels: string[]
    datasets: {
        label: string
        data: number[]
        borderColor?: string
        backgroundColor?: string
        fill?: boolean
        tension?: number
    }[]
    height?: string
}>()

const chartData = computed(() => ({
    labels: props.labels,
    datasets: props.datasets.map((ds) => ({
        ...ds,
        borderColor: ds.borderColor ?? '#091f55',
        backgroundColor: ds.backgroundColor ?? 'rgba(9,31,85,0.1)',
        fill: ds.fill ?? true,
        tension: ds.tension ?? 0.4,
        pointRadius: 4,
        pointBackgroundColor: ds.borderColor ?? '#091f55',
    })),
}))

const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
}
</script>

<template>
    <div :style="{ height: height ?? '12rem' }">
        <Line :data="chartData" :options="options" />
    </div>
</template>
