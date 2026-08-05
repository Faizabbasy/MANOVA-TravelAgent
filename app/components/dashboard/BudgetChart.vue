<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { formatCurrencyIdr } from '~/utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

/**
 * Budget vs Actual (Section 06/Dashboard — Management/Finance/Super Admin/Viewer), diadaptasi dari
 * BudgetChart.vue template lama (dulu data bulanan fiktif dalam USD). Sekarang menerima data project
 * nyata dari fixture terpusat, ditampilkan dalam Rupiah, satu kurva area per project.
 *
 * Line/area (bukan bar) — permintaan visual eksplisit ("kurva ombak"). Data & angka sumbernya sama persis
 * (`budgetIdr`/`actualIdr` per project), cuma cara gambarnya yang berubah.
 */
const props = withDefaults(defineProps<{
  labels: string[]
  budgetIdr: number[]
  actualIdr: number[]
  /** Chart container height (Dashboard card redesign) — purely additive, default reproduces the original fixed height. */
  heightClass?: string
}>(), { heightClass: 'h-[220px]' })

const totalBudget = computed(() => props.budgetIdr.reduce((sum, value) => sum + value, 0))
const totalActual = computed(() => props.actualIdr.reduce((sum, value) => sum + value, 0))
const variancePct = computed(() => {
  if (totalBudget.value === 0) { return 0 }
  return ((totalActual.value - totalBudget.value) / totalBudget.value) * 100
})

const primaryColor = ref('')
const successColor = ref('')
const destructiveColor = ref('')
const mutedColor = ref('')
const cardColor = ref('')
const borderColor = ref('')
const foregroundColor = ref('')

const chartData = ref<any>(null)
const chartOptions = ref<any>(null)

onMounted(async () => {
  await nextTick()

  const rootStyles = getComputedStyle(document.documentElement)
  primaryColor.value = rootStyles.getPropertyValue('--primary').trim()
  successColor.value = rootStyles.getPropertyValue('--success').trim()
  destructiveColor.value = rootStyles.getPropertyValue('--destructive').trim()
  mutedColor.value = rootStyles.getPropertyValue('--muted-foreground').trim()
  cardColor.value = rootStyles.getPropertyValue('--card').trim()
  borderColor.value = rootStyles.getPropertyValue('--border').trim()
  foregroundColor.value = rootStyles.getPropertyValue('--foreground').trim()

  const formatHSL = (hsl: string) => `hsl(${hsl.replace(/\s+/g, ', ')})`
  const toCommaHsl = (hsl: string) => hsl.replace(/\s+/g, ', ')
  const budgetHsl = toCommaHsl(primaryColor.value)
  const actualHsl = toCommaHsl(totalActual.value > totalBudget.value ? destructiveColor.value : successColor.value)
  const muted = formatHSL(mutedColor.value)
  const surface = formatHSL(cardColor.value)
  const border = formatHSL(borderColor.value)
  const ink = formatHSL(foregroundColor.value)

  /** Area gradien halus di bawah tiap kurva — pola sama seperti `TrendAreaChart.vue` (fade dari ~32% ke ~2% opacity). */
  function areaGradient (chart: any, hsl: string) {
    const { ctx, chartArea } = chart
    if (!chartArea) { return `hsla(${hsl}, 0.18)` }
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, `hsla(${hsl}, 0.38)`)
    gradient.addColorStop(1, `hsla(${hsl}, 0.03)`)
    return gradient
  }

  chartData.value = {
    labels: props.labels,
    datasets: [
      {
        label: 'Budget',
        data: props.budgetIdr,
        borderColor: `hsl(${budgetHsl})`,
        borderWidth: 2.5,
        backgroundColor: (context: any) => areaGradient(context.chart, budgetHsl),
        fill: 'origin',
        tension: 0.45,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: `hsl(${budgetHsl})`,
        pointBorderColor: surface,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      },
      {
        label: 'Actual',
        data: props.actualIdr,
        borderColor: `hsl(${actualHsl})`,
        borderWidth: 2.5,
        backgroundColor: (context: any) => areaGradient(context.chart, actualHsl),
        fill: 'origin',
        tension: 0.45,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: `hsl(${actualHsl})`,
        pointBorderColor: surface,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      }
    ]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: muted,
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 16
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: surface,
        borderColor: border,
        borderWidth: 1,
        titleColor: ink,
        bodyColor: ink,
        footerColor: muted,
        footerFont: { weight: 'normal' as const },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${formatCurrencyIdr(context.parsed.y)}`,
          footer: (items: any[]) => {
            const index = items[0]?.dataIndex
            if (index === undefined) { return '' }
            const variance = (props.actualIdr[index] ?? 0) - (props.budgetIdr[index] ?? 0)
            return `Variance: ${variance > 0 ? '+' : ''}${formatCurrencyIdr(variance)}`
          }
        }
      }
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: muted, font: { size: 12 } }
      },
      y: {
        border: { display: false },
        grid: { color: `hsla(${toCommaHsl(borderColor.value)}, 0.6)`, drawTicks: false, lineWidth: 1 },
        ticks: {
          color: muted,
          font: { size: 12 },
          callback: (value: any) => `${(Number(value) / 1_000_000).toLocaleString('id-ID')} jt`
        }
      }
    }
  }
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div>
        <p class="text-xs text-muted-foreground">
          Total Budget vs Actual
        </p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xl font-bold text-foreground">{{ formatCurrencyIdr(totalActual) }}</span>
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
            :class="variancePct > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'"
          >
            {{ variancePct > 0 ? '↑' : '↓' }} {{ Math.abs(variancePct).toFixed(1) }}% vs budget
          </span>
        </div>
      </div>
    </div>
    <div :class="props.heightClass">
      <Line v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
