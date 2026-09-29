<script setup lang="ts">
import { Bar } from 'vue-chartjs'
import {
  BarController, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip
} from 'chart.js'
import type { CashFlowRow } from '~/types/api'
import { periodLabel, periodShortLabel } from '~/lib/finance/cashflow'
import { compactRupiah } from '~/lib/finance/trend'
import { formatMoneyMinor } from '~/lib/money'

ChartJS.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip)

/**
 * Money in (up) and out (down) per period, with the projected balance at the end of each period as a line.
 * The table next to it states the same numbers; the chart only helps the eye. Clicking a period selects it.
 */
const props = defineProps<{ rows: CashFlowRow[]; today: string; selected: number | null; balanceLabel: string }>()
const emit = defineEmits<{ select: [index: number] }>()

const data = shallowRef<any>(null)
const options = shallowRef<any>(null)

function hsl (name: string, alpha?: number) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/\s+/g, ', ')
  return alpha === undefined ? `hsl(${v})` : `hsla(${v}, ${alpha})`
}

function build () {
  const rows = props.rows
  const dim = (i: number) => props.selected !== null && props.selected !== i
  data.value = {
    labels: rows.map(r => periodShortLabel(r, props.today)),
    datasets: [
      {
        type: 'line',
        label: props.balanceLabel,
        data: rows.map(r => Number(r.closingMinor)),
        borderColor: hsl('--primary'),
        backgroundColor: hsl('--primary'),
        borderWidth: 2,
        // Straight segments: a curve would suggest balances between the points that are not in the data.
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: rows.map(r => (r.closingMinor.startsWith('-') ? hsl('--destructive') : hsl('--primary'))),
        order: 0
      },
      {
        type: 'bar',
        label: 'Uang masuk',
        data: rows.map(r => Number(r.incomingMinor)),
        backgroundColor: rows.map((_, i) => hsl('--success', dim(i) ? 0.25 : 0.75)),
        borderRadius: 4,
        maxBarThickness: 36,
        order: 1
      },
      {
        type: 'bar',
        label: 'Uang keluar',
        data: rows.map(r => -Number(r.outgoingMinor)),
        backgroundColor: rows.map((_, i) => hsl('--destructive', dim(i) ? 0.2 : 0.6)),
        borderRadius: 4,
        maxBarThickness: 36,
        order: 1
      }
    ]
  }
  options.value = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    onClick: (_e: unknown, elements: { index: number }[]) => { if (elements[0]) { emit('select', elements[0].index) } },
    onHover: (e: any, elements: unknown[]) => { if (e.native?.target) { e.native.target.style.cursor = elements.length ? 'pointer' : 'default' } },
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, color: hsl('--muted-foreground'), font: { size: 11 } } },
      tooltip: {
        backgroundColor: hsl('--card'),
        borderColor: hsl('--border'),
        borderWidth: 1,
        titleColor: hsl('--foreground'),
        bodyColor: hsl('--foreground'),
        padding: 10,
        callbacks: {
          title: (c: any[]) => periodLabel(props.rows[c[0].dataIndex]!, props.today),
          label: (c: any) => {
            const r = props.rows[c.dataIndex]!
            const value = c.dataset.type === 'line' ? r.closingMinor : c.datasetIndex === 1 ? r.incomingMinor : r.outgoingMinor
            return ` ${c.dataset.label}: ${formatMoneyMinor(value)}`
          }
        }
      }
    },
    scales: {
      x: { stacked: true, border: { display: false }, grid: { display: false }, ticks: { color: hsl('--muted-foreground'), font: { size: 11 }, maxRotation: 0, autoSkip: true } },
      y: {
        stacked: false,
        border: { display: false },
        grid: { color: (c: any) => (c.tick.value === 0 ? hsl('--foreground', 0.35) : hsl('--border')), drawTicks: false },
        ticks: { color: hsl('--muted-foreground'), font: { size: 11 }, maxTicksLimit: 5, padding: 8, callback: (v: number) => compactRupiah(v) }
      }
    }
  }
}

onMounted(build)
watch(() => [props.rows, props.selected, props.balanceLabel], build)
</script>

<template>
  <div class="h-64 sm:h-72" role="img" :aria-label="`Grafik uang masuk, uang keluar dan ${balanceLabel.toLowerCase()} untuk ${rows.length} periode`">
    <Bar v-if="data && options" :data="data" :options="options" />
  </div>
</template>
