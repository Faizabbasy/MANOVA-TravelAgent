<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip
} from 'chart.js'
import { formatCurrencyIdr } from '~/utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

/**
 * Monthly Cash Flow — Income (Pemasukan) vs Expense (Biaya Langsung + Opex) per periode, dari data yang
 * SAMA dengan `DashboardHeroPanel`/`getRevenueByPeriod()` (bukan angka baru). BEDA dari `BudgetChart`
 * sebelumnya: di sini datanya genuinely rentang waktu kronologis (bulan berjalan), jadi line/area chart
 * halus memang bentuk yang benar (bukan anti-pattern seperti dulu dipakai untuk data per-project).
 *
 * Garis crosshair putus-putus + tooltip custom saat hover — plugin Chart.js lokal (`crosshairPlugin`), tidak
 * mengubah palet: tooltip pakai `--primary` (bukan ungu dari referensi visual).
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

onMounted(async () => {
  await nextTick()

  const rootStyles = getComputedStyle(document.documentElement)
  const toCommaHsl = (hsl: string) => hsl.replace(/\s+/g, ', ')
  const primaryHsl = toCommaHsl(rootStyles.getPropertyValue('--primary').trim())
  const destructiveHsl = toCommaHsl(rootStyles.getPropertyValue('--destructive').trim())
  const mutedHsl = toCommaHsl(rootStyles.getPropertyValue('--muted-foreground').trim())
  const borderHsl = toCommaHsl(rootStyles.getPropertyValue('--border').trim())
  const primaryFgHsl = toCommaHsl(rootStyles.getPropertyValue('--primary-foreground').trim())

  function areaGradient (chart: any, hsl: string) {
    const { ctx, chartArea } = chart
    if (!chartArea) { return `hsla(${hsl}, 0.16)` }
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, `hsla(${hsl}, 0.32)`)
    gradient.addColorStop(1, `hsla(${hsl}, 0.02)`)
    return gradient
  }

  chartData.value = {
    labels: props.labels,
    datasets: [
      {
        label: 'Income',
        data: props.income,
        borderColor: `hsl(${primaryHsl})`,
        borderWidth: 2.5,
        backgroundColor: (context: any) => areaGradient(context.chart, primaryHsl),
        fill: 'origin',
        tension: 0.42,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: `hsl(${primaryHsl})`,
        pointBorderColor: `hsl(${primaryFgHsl})`,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      },
      {
        label: 'Expense',
        data: props.expense,
        borderColor: `hsl(${destructiveHsl})`,
        borderWidth: 2.5,
        backgroundColor: (context: any) => areaGradient(context.chart, destructiveHsl),
        fill: 'origin',
        tension: 0.42,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: `hsl(${destructiveHsl})`,
        pointBorderColor: `hsl(${primaryFgHsl})`,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 2
      }
    ]
  }

  /** Garis vertikal putus-putus mengikuti titik hover aktif — nuansa "crosshair" seperti referensi. */
  const crosshairPlugin = {
    id: 'crosshair',
    afterDraw (chart: any) {
      const active = chart.tooltip?.getActiveElements?.() ?? []
      if (!active.length) { return }
      const { ctx, chartArea } = chart
      const x = active[0].element.x
      ctx.save()
      ctx.beginPath()
      ctx.setLineDash([4, 4])
      ctx.moveTo(x, chartArea.top)
      ctx.lineTo(x, chartArea.bottom)
      ctx.lineWidth = 1
      ctx.strokeStyle = `hsl(${primaryHsl})`
      ctx.stroke()
      ctx.restore()
    }
  }
  chartPlugins.value = [crosshairPlugin]

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: `hsl(${primaryHsl})`,
        titleColor: `hsl(${primaryFgHsl})`,
        bodyColor: `hsl(${primaryFgHsl})`,
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${formatCurrencyIdr(context.parsed.y)}`
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
  <div :class="heightClass ?? 'h-[280px]'">
    <Line v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" :plugins="chartPlugins" />
  </div>
</template>
