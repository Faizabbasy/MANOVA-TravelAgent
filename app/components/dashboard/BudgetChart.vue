<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const data = [
  { month: 'Jan', budget: 45000, actual: 42000 },
  { month: 'Feb', budget: 52000, actual: 48000 },
  { month: 'Mar', budget: 48000, actual: 55000 },
  { month: 'Apr', budget: 61000, actual: 58000 },
  { month: 'May', budget: 55000, actual: 52000 },
  { month: 'Jun', budget: 67000, actual: 72000 },
  { month: 'Jul', budget: 72000, actual: 68000 },
  { month: 'Aug', budget: 65000, actual: 63000 },
  { month: 'Sep', budget: 78000, actual: 82000 },
  { month: 'Oct', budget: 85000, actual: 79000 },
  { month: 'Nov', budget: 92000, actual: 88000 },
  { month: 'Dec', budget: 98000, actual: 95000 },
]

// Reactive refs for CSS variables
const primaryColor = ref('')
const successColor = ref('')
const mutedColor = ref('')
const cardColor = ref('')
const borderColor = ref('')
const foregroundColor = ref('')

const chartData = ref<any>(null)
const chartOptions = ref<any>(null)

onMounted(async () => {
  // Wait for next tick to ensure DOM and CSS are fully loaded
  await nextTick()

  // Read CSS variables after DOM is ready
  const rootStyles = getComputedStyle(document.documentElement)
  primaryColor.value = rootStyles.getPropertyValue('--primary').trim()
  successColor.value = rootStyles.getPropertyValue('--success').trim()
  mutedColor.value = rootStyles.getPropertyValue('--muted-foreground').trim()
  cardColor.value = rootStyles.getPropertyValue('--card').trim()
  borderColor.value = rootStyles.getPropertyValue('--border').trim()
  foregroundColor.value = rootStyles.getPropertyValue('--foreground').trim()

  // Debug logging to verify colors are read correctly
  console.log('BudgetChart CSS Variables:', {
    primary: primaryColor.value,
    success: successColor.value,
    muted: mutedColor.value,
    card: cardColor.value,
    border: borderColor.value,
    foreground: foregroundColor.value
  })

  // Convert CSS variable format "239 84% 67%" to "241, 98%, 55%" for Chart.js
  const formatHSL = (hsl: string) => hsl.replace(/\s+/g, ', ')

  // Initialize chart data with function-based backgrounds for gradients
  chartData.value = {
    labels: data.map(d => d.month),
    datasets: [
      {
        label: 'Budget',
        data: data.map(d => d.budget),
        borderColor: `hsl(${formatHSL(primaryColor.value)})`,
        backgroundColor: (context: any) => {
          const chart = context.chart
          const {ctx, chartArea} = chart
          if (!chartArea) return `hsla(${formatHSL(primaryColor.value)}, 0.1)`

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, `hsla(${formatHSL(primaryColor.value)}, 0.2)`)
          gradient.addColorStop(1, `hsla(${formatHSL(primaryColor.value)}, 0)`)
          return gradient
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'Actual',
        data: data.map(d => d.actual),
        borderColor: `hsl(${formatHSL(successColor.value)})`,
        backgroundColor: (context: any) => {
          const chart = context.chart
          const {ctx, chartArea} = chart
          if (!chartArea) return `hsla(${formatHSL(successColor.value)}, 0.1)`

          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, `hsla(${formatHSL(successColor.value)}, 0.2)`)
          gradient.addColorStop(1, `hsla(${formatHSL(successColor.value)}, 0)`)
          return gradient
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
      }
    ]
  }

  chartOptions.value = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: `hsl(${formatHSL(cardColor.value)})`,
        borderColor: `hsl(${formatHSL(borderColor.value)})`,
        borderWidth: 1,
        titleColor: `hsl(${formatHSL(foregroundColor.value)})`,
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
        padding: 12,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => `$${context.parsed.y.toLocaleString()}`,
          labelTextColor: (context: any) => {
            // Return color based on dataset index
            return context.datasetIndex === 0
              ? `hsl(${formatHSL(primaryColor.value)})`
              : `hsl(${formatHSL(successColor.value)})`
          }
        }
      }
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: `hsl(${formatHSL(mutedColor.value)})`,
          font: {
            size: 12,
            family: 'Plus Jakarta Sans, system-ui, sans-serif',
            weight: '500'
          }
        }
      },
      y: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: `hsl(${formatHSL(mutedColor.value)})`,
          font: {
            size: 12,
            family: 'Plus Jakarta Sans, system-ui, sans-serif',
            weight: '500'
          },
          callback: (value: any) => `$${value / 1000}k`
        }
      }
    }
  }
})
</script>

<template>
  <div class="bg-card rounded-xl p-6 card-shadow animate-fade-in">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-lg font-semibold text-foreground">Total Profit</h3>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-3xl font-bold text-foreground">$846.7K</span>
          <span class="text-sm text-success font-medium flex items-center gap-1">
            <span class="inline-block w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-success" />
            24.4%
          </span>
          <span class="text-sm text-muted-foreground">vs. last period</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-primary" />
          <span class="text-muted-foreground">Budget</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-success" />
          <span class="text-muted-foreground">Actual</span>
        </div>
      </div>
    </div>

    <div class="h-[240px]">
      <Line v-if="chartData && chartOptions" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
