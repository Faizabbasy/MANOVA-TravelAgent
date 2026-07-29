<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const data = [
  { name: 'Development', value: 45000, colorVar: '--primary' },
  { name: 'Design', value: 28000, colorVar: '--success' },
  { name: 'Marketing', value: 18000, colorVar: '--warning' },
  { name: 'Operations', value: 12000, colorVar: '--chart-4' },
  { name: 'Other', value: 8000, colorVar: '--chart-5' },
]

const total = data.reduce((sum, item) => sum + item.value, 0)

// Reactive refs for chart data
const chartData = ref<any>(null)
const chartOptions = ref<any>(null)
const coloredData = ref<any[]>([])

onMounted(async () => {
  // Wait for next tick to ensure DOM and CSS are fully loaded
  await nextTick()

  // Read CSS variables after DOM is ready
  const rootStyles = getComputedStyle(document.documentElement)

  // Convert CSS variable format "239 84% 67%" to "241, 98%, 55%" for Chart.js
  const formatHSL = (hsl: string) => hsl.replace(/\s+/g, ', ')

  // Build colored data array with resolved CSS variables
  coloredData.value = data.map(item => {
    const cssValue = rootStyles.getPropertyValue(item.colorVar).trim()
    const color = `hsl(${formatHSL(cssValue)})`
    return {
      ...item,
      cssValue, // Keep raw CSS value for debugging
      color
    }
  })

  // Debug logging with more detail
  console.log('Expense Categories CSS Variables:', coloredData.value.map(d => ({
    name: d.name,
    cssVar: d.colorVar,
    cssValue: d.cssValue,
    color: d.color
  })))

  chartData.value = {
    labels: coloredData.value.map(d => d.name),
    datasets: [{
      data: coloredData.value.map(d => d.value),
      backgroundColor: coloredData.value.map(d => d.color),
      borderWidth: 0,
      spacing: 2, // Match React's paddingAngle={2}
    }]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '63.6%',  // Match React's 35/55 ratio (35/55 = 0.636)
    plugins: {
      legend: { display: false },
      tooltip: {
        titleFont: {
          family: 'Plus Jakarta Sans, system-ui, sans-serif',
          size: 12,
          weight: '500'
        },
        bodyFont: {
          family: 'Plus Jakarta Sans, system-ui, sans-serif',
          size: 12,
          weight: '500'
        },
        callbacks: {
          label: (context: any) => `$${context.parsed.toLocaleString()}`
        }
      }
    }
  }
})
</script>

<template>
  <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-foreground">Expense Categories</h3>
      <p class="text-sm text-muted-foreground mt-1">Breakdown by department</p>
    </div>

    <div class="flex items-center gap-6">
      <div class="w-32 h-32">
        <Doughnut v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
      </div>

      <div v-if="coloredData.length" class="flex-1 space-y-3">
        <div
          v-for="item in coloredData"
          :key="item.name"
          class="flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: item.color }"
            />
            <span class="text-sm text-foreground">{{ item.name }}</span>
          </div>
          <div class="text-right">
            <span class="text-sm font-medium text-foreground">
              ${{ item.value.toLocaleString() }}
            </span>
            <span class="text-xs text-muted-foreground ml-2">
              {{ ((item.value / total) * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
