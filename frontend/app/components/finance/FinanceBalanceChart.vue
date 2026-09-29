<script setup lang="ts">
import { Line } from 'vue-chartjs'
import { CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { compactRupiah } from '~/lib/finance/trend'
import { formatBusinessDate } from '~/lib/finance/dates'
import { formatMoneyMinor } from '~/lib/money'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

/**
 * Company balance per day (end of day). Quiet line, compact Rupiah axis, exact figure in the tooltip. The
 * same numbers are stated in text next to the chart (start → today), so the chart is never the only source.
 */
const props = defineProps<{ dates: string[]; totals: string[] }>()

const data = shallowRef<any>(null)
const options = shallowRef<any>(null)

function hsl (name: string, alpha?: number) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ', ')
  return alpha === undefined ? `hsl(${v})` : `hsla(${v}, ${alpha})`
}

function build () {
  const values = props.totals.map(t => Number(t))
  data.value = {
    labels: props.dates.map(d => formatBusinessDate(d, { short: true })),
    datasets: [{
      data: values,
      borderColor: hsl('--primary'),
      borderWidth: 2,
      tension: 0.25,
      fill: true,
      backgroundColor: (ctx: any) => {
        const { chart } = ctx
        if (!chart.chartArea) { return undefined }
        const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom)
        g.addColorStop(0, hsl('--primary', 0.18))
        g.addColorStop(1, hsl('--primary', 0))
        return g
      },
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: hsl('--primary'),
      pointHoverBorderColor: hsl('--card'),
      pointHoverBorderWidth: 2
    }]
  }
  options.value = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: hsl('--card'),
        borderColor: hsl('--border'),
        borderWidth: 1,
        titleColor: hsl('--muted-foreground'),
        bodyColor: hsl('--foreground'),
        bodyFont: { weight: '600' },
        padding: 10,
        displayColors: false,
        callbacks: { label: (c: any) => formatMoneyMinor(props.totals[c.dataIndex] ?? '0') }
      }
    },
    scales: {
      x: { border: { display: false }, grid: { display: false }, ticks: { color: hsl('--muted-foreground'), font: { size: 11 }, maxTicksLimit: 6, maxRotation: 0 } },
      y: {
        border: { display: false },
        grid: { color: hsl('--border'), drawTicks: false },
        ticks: { color: hsl('--muted-foreground'), font: { size: 11 }, maxTicksLimit: 4, padding: 8, callback: (v: number) => compactRupiah(v) }
      }
    }
  }
}

onMounted(build)
watch(() => [props.dates, props.totals], build)
</script>

<template>
  <div class="h-44 sm:h-52" role="img" :aria-label="`Grafik saldo harian ${dates.length} hari terakhir`">
    <Line v-if="data && options" :data="data" :options="options" />
  </div>
</template>
