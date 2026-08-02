<script setup lang="ts">
import { Home, ArrowLeft } from 'lucide-vue-next'

definePageMeta({
  layout: 'dashboard'
})

const router = useRouter()

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
    <div class="bg-card rounded-3xl p-12 card-shadow max-w-2xl w-full">
      <div class="flex flex-col items-center">
        <!-- Animated 404 Illustration -->
        <div class="relative mb-8">
          <svg
            width="400"
            height="300"
            viewBox="0 0 400 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="max-w-full h-auto"
          >
            <!-- Background circles (decorative) -->
            <circle
              cx="80"
              cy="80"
              r="60"
              fill="hsl(241, 98%, 55%)"
              opacity="0.1"
              class="pulse-1"
            />
            <circle
              cx="320"
              cy="220"
              r="50"
              fill="hsl(142, 76%, 36%)"
              opacity="0.1"
              class="pulse-2"
            />
            <circle
              cx="200"
              cy="50"
              r="40"
              fill="hsl(38, 92%, 50%)"
              opacity="0.1"
              class="pulse-3"
            />

            <!-- 404 Text with gradient -->
            <defs>
              <linearGradient id="gradient404" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:hsl(241, 98%, 55%);stop-opacity:1" />
                <stop offset="100%" style="stop-color:hsl(280, 67%, 60%);stop-opacity:1" />
              </linearGradient>
            </defs>

            <!-- Large 404 -->
            <text
              x="200"
              y="180"
              font-family="Plus Jakarta Sans, sans-serif"
              font-size="120"
              font-weight="700"
              fill="url(#gradient404)"
              text-anchor="middle"
              opacity="0.15"
            >
              404
            </text>

            <!-- Floating Document Icon -->
            <g class="animate-float">
              <rect
                x="140"
                y="100"
                width="120"
                height="140"
                rx="8"
                fill="white"
                stroke="hsl(220, 13%, 91%)"
                stroke-width="2"
              />
              <line
                x1="160"
                y1="130"
                x2="240"
                y2="130"
                stroke="hsl(220, 13%, 91%)"
                stroke-width="3"
                stroke-linecap="round"
              />
              <line
                x1="160"
                y1="155"
                x2="240"
                y2="155"
                stroke="hsl(220, 13%, 91%)"
                stroke-width="3"
                stroke-linecap="round"
              />
              <line
                x1="160"
                y1="180"
                x2="210"
                y2="180"
                stroke="hsl(220, 13%, 91%)"
                stroke-width="3"
                stroke-linecap="round"
              />

              <!-- Question mark on document -->
              <circle cx="200" cy="210" r="15" fill="hsl(241, 98%, 55%)" opacity="0.2" />
              <text
                x="200"
                y="220"
                font-family="Arial"
                font-size="24"
                font-weight="bold"
                fill="hsl(241, 98%, 55%)"
                text-anchor="middle"
              >?</text>
            </g>

            <!-- Magnifying Glass -->
            <g class="animate-search">
              <circle
                cx="280"
                cy="120"
                r="25"
                fill="none"
                stroke="hsl(241, 98%, 55%)"
                stroke-width="4"
              />
              <line
                x1="298"
                y1="138"
                x2="320"
                y2="160"
                stroke="hsl(241, 98%, 55%)"
                stroke-width="4"
                stroke-linecap="round"
              />
            </g>
          </svg>
        </div>

        <!-- Text Content -->
        <div class="text-center mb-8 space-y-3">
          <h1 class="text-6xl font-bold text-foreground">
            404
          </h1>
          <h2 class="text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p class="text-muted-foreground max-w-md mx-auto">
            Oops! The page you're looking for seems to have wandered off.
            Let's get you back on track.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" size="lg" class="gap-2" @click="goBack">
            <ArrowLeft class="h-4 w-4" />
            Go Back
          </Button>
          <Button as-child size="lg" class="gap-2 bg-primary hover:bg-primary/90">
            <NuxtLink to="/">
              <Home class="h-4 w-4" />
              Go Home
            </NuxtLink>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-20px);
  }
}

@keyframes search {
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-search {
  animation: search 2s ease-in-out infinite;
  transform-origin: center;
}

.pulse-1 {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.pulse-2 {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  animation-delay: 0.5s;
}

.pulse-3 {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  animation-delay: 1s;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.1;
  }
  50% {
    opacity: 0.2;
  }
}
</style>
