<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { formatCurrencyIdr } from '~/utils/format'

ChartJS.register(ArcElement, Tooltip, Legend)

/**
 * Cost breakdown (Section 06/Dashboard — Finance/Super Admin), diadaptasi dari ExpenseCategories.vue
 * template lama (dulu breakdown fiktif per department dalam USD). `actualCostIdr` per Project adalah
 * satu-satunya angka cost yang tersedia di fixture (belum ada breakdown per jenis layanan), sehingga
 * breakdown di sini per-project, bukan per-kategori layanan — lihat catatan di section report.
 */
const props = defineProps<{
  items: { name: string; valueIdr: number }[]
}>()

const total = computed(() => props.items.reduce((sum, item) => sum + item.valueIdr, 0))

const colorVars = ['--primary', '--success', '--warning', '--chart-4', '--chart-5', '--destructive']
const coloredData = ref<{ name: string; valueIdr: number; color: string }[]>([])
const chartData = ref<any>(null)
const chartOptions = ref<any>(null)
const chartRef = ref<{ chart: any } | null>(null)
/** Legend rows toggled off by the user (click-to-toggle, mirrors the built-in Chart.js legend behavior). */
const hiddenIndices = ref<Set<number>>(new Set())

onMounted(async () => {
  await nextTick()

  const rootStyles = getComputedStyle(document.documentElement)
  const formatHSL = (hsl: string) => hsl.replace(/\s+/g, ', ')
  coloredData.value = props.items.map((item, index) => {
    const cssValue = rootStyles.getPropertyValue(colorVars[index % colorVars.length]).trim()
    return { ...item, color: `hsl(${formatHSL(cssValue)})` }
  })

  chartData.value = {
    labels: coloredData.value.map(d => d.name),
    datasets: [{
      data: coloredData.value.map(d => d.valueIdr),
      backgroundColor: coloredData.value.map(d => d.color),
      hoverBackgroundColor: coloredData.value.map(d => d.color),
      borderWidth: 0,
      spacing: 3,
      hoverOffset: 10,
      borderRadius: 4
    }]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '63.6%',
    animation: { animateRotate: true, animateScale: true, duration: 900, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrencyIdr(context.parsed)
        }
      }
    }
  }
})

/** Click-to-toggle legend row — same effect as clicking a native Chart.js legend item. */
function toggleSegment (index: number) {
  const chart = chartRef.value?.chart
  if (!chart) { return }
  chart.toggleDataVisibility(index)
  chart.update()
  if (hiddenIndices.value.has(index)) {
    hiddenIndices.value.delete(index)
  } else {
    hiddenIndices.value.add(index)
  }
  hiddenIndices.value = new Set(hiddenIndices.value)
}
</script>

<template>
  <div class="flex items-center gap-8">
    <div class="relative w-36 h-36 shrink-0">
      <Doughnut v-if="chartData && chartOptions" ref="chartRef" :data="chartData" :options="chartOptions" />
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span class="text-[9px] tracking-wide uppercase text-muted-foreground">Total</span>
        <span class="text-[13px] font-bold text-foreground">{{ formatCurrencyIdr(total) }}</span>
      </div>
    </div>

    <div v-if="coloredData.length" class="flex-1 space-y-3 min-w-0">
      <button
        v-for="(item, index) in coloredData"
        :key="item.name"
        type="button"
        class="flex w-full items-center justify-between gap-2 rounded-md -mx-1.5 px-1.5 py-0.5 text-left transition-colors hover:bg-muted/60"
        :class="hiddenIndices.has(index) && 'opacity-40'"
        @click="toggleSegment(index)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
          <span class="text-sm truncate text-foreground">{{ item.name }}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-medium text-foreground">{{ formatCurrencyIdr(item.valueIdr) }}</span>
          <span class="text-xs ml-2 text-muted-foreground">
            {{ total > 0 ? ((item.valueIdr / total) * 100).toFixed(0) : 0 }}%
          </span>
        </div>
      </button>
    </div>
  </div>
</template>
