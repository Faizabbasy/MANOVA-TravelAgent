<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip
} from 'chart.js'
import { formatCurrencyIdr } from '~/utils/format'

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, PointElement, LineElement, LineController, Filler, Tooltip)

/**
 * Monthly Cash Flow — Income vs Expense per periode sebagai grouped bar, dioverlay garis "Net" (Income −
 * Expense) supaya tren untung/rugi bulanan terbaca sekali lihat tanpa menghitung manual. Data SAMA dengan
 * `DashboardHeroPanel`/`getRevenueByPeriod()`.
 *
 * Interaksi custom (bukan default Chart.js):
 * - "Spotlight" band di belakang grup bar yang di-hover (plugin lokal `hoverBandPlugin`).
 * - Bar redup untuk bulan yang tidak sedang di-hover (backgroundColor sebagai function, dibaca ulang tiap
 *   `chart.update()`).
 * - Tooltip HTML kustom (bukan tooltip canvas bawaan) supaya bisa menampilkan baris Income/Expense/Net
 *   dengan dot warna + baris Net yang ditonjolkan.
 */
const props = defineProps<{
  labels: string[]
  income: number[]
  expense: number[]
  heightClass?: string
}>()

const chartData = ref<any>(null)
const chartOptions = ref<any>(null)
const chartPlugins = ref<any[]>([])
const containerEl = ref<HTMLElement | null>(null)

interface TooltipRow { label: string; color: string; value: string; muted?: boolean }
const tooltipState = reactive({
  visible: false,
  x: 0,
  y: 0,
  align: 'center' as 'left' | 'center' | 'right',
  title: '',
  rows: [] as TooltipRow[]
})

const net = computed(() => props.income.map((value, index) => value - (props.expense[index] ?? 0)))

let activeIndex: number | null = null

onMounted(async () => {
  await nextTick()

  const rootStyles = getComputedStyle(document.documentElement)
  const toCommaHsl = (hsl: string) => hsl.replace(/\s+/g, ', ')
  const primaryHsl = toCommaHsl(rootStyles.getPropertyValue('--primary').trim())
  const destructiveHsl = toCommaHsl(rootStyles.getPropertyValue('--destructive').trim())
  const successHsl = toCommaHsl(rootStyles.getPropertyValue('--success').trim() || rootStyles.getPropertyValue('--primary').trim())
  const mutedHsl = toCommaHsl(rootStyles.getPropertyValue('--muted-foreground').trim())
  const borderHsl = toCommaHsl(rootStyles.getPropertyValue('--border').trim())
  const foregroundHsl = toCommaHsl(rootStyles.getPropertyValue('--foreground').trim())

  function barGradient (chart: any, hsl: string, dim: boolean) {
    const { ctx, chartArea } = chart
    if (!chartArea) { return `hsla(${hsl}, ${dim ? 0.18 : 0.85})` }
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    const top = dim ? 0.16 : 0.95
    const bottom = dim ? 0.08 : 0.45
    gradient.addColorStop(0, `hsla(${hsl}, ${top})`)
    gradient.addColorStop(1, `hsla(${hsl}, ${bottom})`)
    return gradient
  }

  function seriesColor (context: any, hsl: string) {
    const idx = context.dataIndex
    const dim = activeIndex !== null && activeIndex !== idx
    return barGradient(context.chart, hsl, dim)
  }

  chartData.value = {
    labels: props.labels,
    datasets: [
      {
        type: 'bar',
        label: 'Income',
        data: props.income,
        backgroundColor: (context: any) => seriesColor(context, primaryHsl),
        hoverBackgroundColor: (context: any) => seriesColor(context, primaryHsl),
        borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.62,
        order: 2
      },
      {
        type: 'bar',
        label: 'Expense',
        data: props.expense,
        backgroundColor: (context: any) => seriesColor(context, destructiveHsl),
        hoverBackgroundColor: (context: any) => seriesColor(context, destructiveHsl),
        borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barPercentage: 0.72,
        categoryPercentage: 0.62,
        order: 2
      },
      {
        type: 'line',
        label: 'Net',
        data: net.value,
        borderColor: `hsl(${successHsl})`,
        backgroundColor: `hsl(${successHsl})`,
        borderWidth: 2.5,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: `hsl(${successHsl})`,
        pointBorderColor: `hsl(0, 0%, 100%)`,
        pointBorderWidth: 2,
        fill: false,
        order: 1
      }
    ]
  }

  /** Kolom "spotlight" di belakang grup bar yang sedang di-hover — dibaca dari `activeIndex`. */
  const hoverBandPlugin = {
    id: 'hoverBand',
    beforeDatasetsDraw (chart: any) {
      if (activeIndex === null) { return }
      const { ctx, chartArea, scales } = chart
      const xScale = scales.x
      if (!xScale) { return }
      const centerX = xScale.getPixelForValue(activeIndex)
      const bandWidth = (chartArea.width / props.labels.length) * 0.86
      const left = centerX - bandWidth / 2
      const radius = 12
      ctx.save()
      ctx.beginPath()
      const top = chartArea.top
      const bottom = chartArea.bottom
      ctx.moveTo(left + radius, top)
      ctx.arcTo(left + bandWidth, top, left + bandWidth, top + radius, radius)
      ctx.lineTo(left + bandWidth, bottom - radius)
      ctx.arcTo(left + bandWidth, bottom, left + bandWidth - radius, bottom, radius)
      ctx.lineTo(left + radius, bottom)
      ctx.arcTo(left, bottom, left, bottom - radius, radius)
      ctx.lineTo(left, top + radius)
      ctx.arcTo(left, top, left + radius, top, radius)
      ctx.closePath()
      ctx.fillStyle = `hsla(${foregroundHsl}, 0.045)`
      ctx.fill()
      ctx.restore()
    }
  }
  chartPlugins.value = [hoverBandPlugin]

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    onHover: (_event: any, elements: any[], chart: any) => {
      const nextIndex = elements.length ? elements[0].index : null
      if (nextIndex !== activeIndex) {
        activeIndex = nextIndex
        chart.update('none')
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: (context: any) => {
          const tooltip = context.tooltip
          if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
            tooltipState.visible = false
            return
          }

          const points = tooltip.dataPoints as any[]
          const incomePoint = points.find(point => point.dataset.label === 'Income')
          const expensePoint = points.find(point => point.dataset.label === 'Expense')
          const netValue = (incomePoint?.parsed.y ?? 0) - (expensePoint?.parsed.y ?? 0)

          tooltipState.title = points[0]?.label ?? ''
          tooltipState.rows = [
            { label: 'Income', color: `hsl(${primaryHsl})`, value: formatCurrencyIdr(incomePoint?.parsed.y ?? 0) },
            { label: 'Expense', color: `hsl(${destructiveHsl})`, value: formatCurrencyIdr(expensePoint?.parsed.y ?? 0) },
            { label: 'Net', color: `hsl(${successHsl})`, value: formatCurrencyIdr(netValue), muted: false }
          ]

          const canvas = context.chart.canvas
          const width = canvas.offsetWidth
          const x = tooltip.caretX
          tooltipState.align = x < width * 0.25 ? 'left' : x > width * 0.75 ? 'right' : 'center'
          tooltipState.x = x
          tooltipState.y = tooltip.caretY
          tooltipState.visible = true
        }
      }
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: mutedHsl ? `hsl(${mutedHsl})` : undefined, font: { size: 12 } }
      },
      y: {
        border: { display: false },
        grid: { color: `hsla(${borderHsl}, 0.6)`, drawTicks: false, lineWidth: 1 },
        ticks: {
          color: `hsl(${mutedHsl})`,
          font: { size: 12 },
          callback: (value: any) => `${(Number(value) / 1_000_000).toLocaleString('id-ID')} jt`
        }
      }
    }
  }
})
</script>

<template>
  <div ref="containerEl" class="relative" :class="heightClass ?? 'h-[280px]'">
    <Bar v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" :plugins="chartPlugins" />

    <div
      v-if="tooltipState.visible"
      class="pointer-events-none absolute z-10 min-w-[168px] rounded-xl border border-border bg-popover/95 p-3 shadow-lg backdrop-blur-sm transition-[left,top] duration-100 ease-out"
      :style="{
        left: `${tooltipState.x}px`,
        top: `${tooltipState.y}px`,
        transform: `translate(${tooltipState.align === 'left' ? '-6%' : tooltipState.align === 'right' ? '-94%' : '-50%'}, calc(-100% - 14px))`
      }"
    >
      <p class="mb-1.5 text-xs font-semibold text-foreground">
        {{ tooltipState.title }}
      </p>
      <div class="space-y-1">
        <div
          v-for="row in tooltipState.rows"
          :key="row.label"
          class="flex items-center justify-between gap-4 text-xs"
          :class="row.label === 'Net' ? 'mt-1.5 border-t border-border pt-1.5 font-semibold text-foreground' : 'text-muted-foreground'"
        >
          <span class="flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: row.color }" />
            {{ row.label }}
          </span>
          <span class="tabular-nums">{{ row.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
