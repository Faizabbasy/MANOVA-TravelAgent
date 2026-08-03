<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

/**
 * Bar chart satu series generik (Repair Phase Section 7 — Insights & Company). Diekstrak dari
 * `BudgetChart.vue` (Dashboard, Section 06) — pola registrasi Chart.js/vue-chartjs dan ekstraksi warna CSS
 * variable yang SAMA, disederhanakan ke satu dataset untuk kebutuhan tren (spending by month, participant
 * trend, change request frequency) di `/client/reports`.
 */
const props = withDefaults(defineProps<{
  labels: string[]
  values: number[]
  valueFormatter?:(value: number) => string
}>(), {
  valueFormatter: (value: number) => String(value)
})

const chartData = ref<any>(null)
const chartOptions = ref<any>(null)

onMounted(async () => {
  await nextTick()
  const rootStyles = getComputedStyle(document.documentElement)
  const primaryColor = rootStyles.getPropertyValue('--primary').trim()
  const mutedColor = rootStyles.getPropertyValue('--muted-foreground').trim()
  const cardColor = rootStyles.getPropertyValue('--card').trim()
  const borderColor = rootStyles.getPropertyValue('--border').trim()
  const foregroundColor = rootStyles.getPropertyValue('--foreground').trim()
  const formatHSL = (hsl: string) => hsl.replace(/\s+/g, ', ')

  chartData.value = {
    labels: props.labels,
    datasets: [{ data: props.values, backgroundColor: `hsla(${formatHSL(primaryColor)}, 0.7)`, borderRadius: 4 }]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: `hsl(${formatHSL(cardColor)})`,
        borderColor: `hsl(${formatHSL(borderColor)})`,
        borderWidth: 1,
        titleColor: `hsl(${formatHSL(foregroundColor)})`,
        bodyColor: `hsl(${formatHSL(foregroundColor)})`,
        padding: 12,
        callbacks: { label: (context: any) => props.valueFormatter(context.parsed.y) }
      }
    },
    scales: {
      x: { border: { display: false }, grid: { display: false }, ticks: { color: `hsl(${formatHSL(mutedColor)})`, font: { size: 11 } } },
      y: { border: { display: false }, grid: { display: false }, ticks: { color: `hsl(${formatHSL(mutedColor)})`, font: { size: 11 } } }
    }
  }
})
</script>

<template>
  <div class="h-[220px]">
    <Bar v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    <EmptyState v-else-if="labels.length === 0" title="Belum ada data" />
  </div>
</template>
