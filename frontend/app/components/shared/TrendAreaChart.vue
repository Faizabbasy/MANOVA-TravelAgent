<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip)

/**
 * Trend chart — line + area wash begitu ada ≥2 periode (kurva tren beneran bisa digambar), kolom tunggal
 * (bar chart) begitu baru 1 periode (satu titik belum punya garis untuk digambar, tapi tetap harus terlihat
 * sebagai chart, bukan cuma angka polos — user request eksplisit, bukan stat-tile tanpa visual).
 */
const props = withDefaults(defineProps<{
  labels: string[]
  values: number[]
  valueFormatter?:(value: number) => string
  /** Slot warna tervalidasi CVD (adjacent + normal-vision floor, light mode) — beda hue antar-card trend supaya tiap card terasa beda, bukan biru semua di seluruh halaman. */
  hue?: 'blue' | 'cyan' | 'green' | 'purple'
}>(), {
  valueFormatter: (value: number) => String(value),
  hue: 'blue'
})

const HUE_VAR: Record<string, string> = { blue: '--chart-1', cyan: '--chart-5', green: '--chart-2', purple: '--chart-4' }

const isSinglePoint = computed(() => props.labels.length === 1)

const chartData = ref<any>(null)
const chartOptions = ref<any>(null)

onMounted(async () => {
  await nextTick()
  const rootStyles = getComputedStyle(document.documentElement)
  const hueHsl = rootStyles.getPropertyValue(HUE_VAR[props.hue]).trim().replace(/\s+/g, ', ')
  const mutedColor = rootStyles.getPropertyValue('--muted-foreground').trim().replace(/\s+/g, ', ')
  const cardColor = rootStyles.getPropertyValue('--card').trim().replace(/\s+/g, ', ')
  const borderColor = rootStyles.getPropertyValue('--border').trim().replace(/\s+/g, ', ')
  const foregroundColor = rootStyles.getPropertyValue('--foreground').trim().replace(/\s+/g, ', ')

  const sharedScales = {
    x: { border: { display: false }, grid: { display: false }, ticks: { color: `hsl(${mutedColor})`, font: { size: 11 } } },
    y: {
      border: { display: false },
      grid: { color: `hsl(${borderColor})`, drawTicks: false },
      ticks: { color: `hsl(${mutedColor})`, font: { size: 11 }, maxTicksLimit: 5 }
    }
  }
  const sharedTooltip = {
    enabled: true,
    backgroundColor: `hsl(${cardColor})`,
    borderColor: `hsl(${borderColor})`,
    borderWidth: 1,
    titleColor: `hsl(${foregroundColor})`,
    bodyColor: `hsl(${foregroundColor})`,
    padding: 10,
    displayColors: false,
    callbacks: { label: (context: any) => props.valueFormatter(context.parsed.y) }
  }

  if (isSinglePoint.value) {
    // Kolom tunggal — magnitude satu periode, mark spec "4px rounded data-end, square di baseline".
    chartData.value = {
      labels: props.labels,
      datasets: [{
        data: props.values,
        backgroundColor: (context: any) => {
          const { ctx, chartArea } = context.chart
          if (!chartArea) { return `hsl(${hueHsl})` }
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, `hsl(${hueHsl})`)
          gradient.addColorStop(1, `hsla(${hueHsl}, 0.55)`)
          return gradient
        },
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: 'bottom',
        maxBarThickness: 72,
        categoryPercentage: 0.5
      }]
    }
    chartOptions.value = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: sharedTooltip },
      scales: sharedScales
    }
    return
  }

  chartData.value = {
    labels: props.labels,
    datasets: [{
      data: props.values,
      borderColor: `hsl(${hueHsl})`,
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      backgroundColor: (context: any) => {
        const { ctx, chartArea } = context.chart
        if (!chartArea) { return undefined }
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, `hsla(${hueHsl}, 0.32)`)
        gradient.addColorStop(1, `hsla(${hueHsl}, 0.02)`)
        return gradient
      },
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointBackgroundColor: `hsl(${hueHsl})`,
      pointBorderColor: `hsl(${cardColor})`,
      pointBorderWidth: 2,
      pointHoverBorderWidth: 2
    }]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: sharedTooltip },
    scales: sharedScales
  }
})
</script>

<template>
  <div class="h-[220px]">
    <EmptyState v-if="labels.length === 0" title="Belum ada data" />

    <Bar v-else-if="isSinglePoint && chartData && chartOptions" :data="chartData" :options="chartOptions" />
    <Line v-else-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
  </div>
</template>
