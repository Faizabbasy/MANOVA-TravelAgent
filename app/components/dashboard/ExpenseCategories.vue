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
      borderWidth: 0,
      spacing: 2,
    }],
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '63.6%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrencyIdr(context.parsed),
        },
      },
    },
  }
})
</script>

<template>
  <div class="flex items-center gap-6">
    <div class="w-32 h-32 shrink-0">
      <Doughnut v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    </div>

    <div v-if="coloredData.length" class="flex-1 space-y-3 min-w-0">
      <div
        v-for="item in coloredData"
        :key="item.name"
        class="flex items-center justify-between gap-2"
      >
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }" />
          <span class="text-sm text-foreground truncate">{{ item.name }}</span>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-medium text-foreground">{{ formatCurrencyIdr(item.valueIdr) }}</span>
          <span class="text-xs text-muted-foreground ml-2">
            {{ total > 0 ? ((item.valueIdr / total) * 100).toFixed(0) : 0 }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
