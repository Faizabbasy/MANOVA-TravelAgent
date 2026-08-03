<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js'
import { formatCurrencyIdr } from '~/utils/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

/**
 * Budget vs Actual (Section 06/Dashboard — Management/Finance/Super Admin/Viewer), diadaptasi dari
 * BudgetChart.vue template lama (dulu data bulanan fiktif dalam USD). Sekarang menerima data project
 * nyata dari fixture terpusat, ditampilkan dalam Rupiah, satu bar-pair per project.
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

  /** Soft top-to-bottom gradient per bar (livelier than a flat fill) — built once canvas layout is known. */
  function verticalGradient (chart: any, hsl: string) {
    const { ctx, chartArea } = chart
    if (!chartArea) { return `hsla(${hsl}, 0.75)` }
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, `hsla(${hsl}, 0.55)`)
    gradient.addColorStop(1, `hsla(${hsl}, 0.95)`)
    return gradient
  }

  chartData.value = {
    labels: props.labels,
    datasets: [
      {
        label: 'Budget',
        data: props.budgetIdr,
        backgroundColor: (context: any) => verticalGradient(context.chart, budgetHsl),
        hoverBackgroundColor: `hsla(${budgetHsl}, 1)`,
        borderRadius: 8,
        borderSkipped: false,
        categoryPercentage: 0.6,
        barPercentage: 0.9
      },
      {
        label: 'Actual',
        data: props.actualIdr,
        backgroundColor: (context: any) => verticalGradient(context.chart, actualHsl),
        hoverBackgroundColor: `hsla(${actualHsl}, 1)`,
        borderRadius: 8,
        borderSkipped: false,
        categoryPercentage: 0.6,
        barPercentage: 0.9
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
          pointStyle: 'circle'
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: surface,
        borderColor: border,
        borderWidth: 1,
        titleColor: ink,
        bodyColor: ink,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${formatCurrencyIdr(context.parsed.y)}`
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
        grid: { color: border, drawTicks: false, lineWidth: 1 },
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
            class="text-xs font-medium"
            :class="variancePct > 0 ? 'text-destructive' : 'text-success'"
          >
            {{ variancePct > 0 ? '+' : '' }}{{ variancePct.toFixed(1) }}% vs budget
          </span>
        </div>
      </div>
    </div>
    <div :class="props.heightClass">
      <Bar v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
