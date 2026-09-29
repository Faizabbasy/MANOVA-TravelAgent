<template>
  <Transition name="loading">
    <div v-if="isLoading" class="loading-bar">
      <div class="loading-bar-progress" :style="{ width: progress + '%' }" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const router = useRouter()
const isLoading = ref(false)
const progress = ref(0)
let interval: NodeJS.Timeout | null = null

const startLoading = () => {
  isLoading.value = true
  progress.value = 0

  // Start immediately at 10%
  progress.value = 10

  // Simulate progress with slower increments for slower connections
  if (interval) { clearInterval(interval) }
  interval = setInterval(() => {
    // Slow down as we approach 90%
    const increment = progress.value < 70 ? Math.random() * 15 : Math.random() * 5
    if (progress.value < 90) {
      progress.value += increment
    }
  }, 300) // Slower interval for visibility
}

const finishLoading = () => {
  if (interval) { clearInterval(interval) }
  progress.value = 100

  // Keep the bar visible a bit longer before hiding
  setTimeout(() => {
    isLoading.value = false
    progress.value = 0
  }, 400)
}

// Watch for route changes - this will trigger on ALL navigations
router.beforeEach((to, from, next) => {
  if (to.path !== from.path) {
    startLoading()
  }
  next()
})

router.afterEach(() => {
  finishLoading()
})

router.onError(() => {
  finishLoading()
})

onUnmounted(() => {
  if (interval) { clearInterval(interval) }
})
</script>

<style scoped>
.loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  z-index: 99999;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.05);
}

.loading-bar-progress {
  height: 100%;
  background: linear-gradient(90deg, #FF7732 0%, #FD0091 100%);
  transition: width 0.3s ease-out;
  will-change: width;
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.2s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}
</style>
