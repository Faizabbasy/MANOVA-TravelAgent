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
const props = defineProps<{
  labels: string[]
  budgetIdr: number[]
  actualIdr: number[]
}>()

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

  const formatHSL = (hsl: string) => hsl.replace(/\s+/g, ', ')
  const actualColor = totalActual.value > totalBudget.value ? destructiveColor.value : successColor.value

  chartData.value = {
    labels: props.labels,
    datasets: [
      {
        label: 'Budget',
        data: props.budgetIdr,
        backgroundColor: `hsla(${formatHSL(primaryColor.value)}, 0.7)`,
        borderRadius: 4
      },
      {
        label: 'Actual',
        data: props.actualIdr,
        backgroundColor: `hsla(${formatHSL(actualColor)}, 0.7)`,
        borderRadius: 4
      }
    ]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: `hsl(${formatHSL(mutedColor.value)})`,
          font: { family: 'Plus Jakarta Sans, system-ui, sans-serif', size: 12 },
          usePointStyle: true
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: `hsl(${formatHSL(cardColor.value)})`,
        borderColor: `hsl(${formatHSL(borderColor.value)})`,
        borderWidth: 1,
        titleColor: `hsl(${formatHSL(foregroundColor.value)})`,
        bodyColor: `hsl(${formatHSL(foregroundColor.value)})`,
        padding: 12,
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${formatCurrencyIdr(context.parsed.y)}`
        }
      }
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { color: `hsl(${formatHSL(mutedColor.value)})`, font: { size: 12 } }
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: `hsl(${formatHSL(mutedColor.value)})`,
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
    <div class="h-[220px]">
      <Bar v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
