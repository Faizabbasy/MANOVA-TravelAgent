<script setup lang="ts">
import { useProjectsSync } from '~/data/projects-sync'

const isMobile = useIsMobile()
/** Project milik server (S3a): dimuat sekali per user yang login, menimpa header di array `PROJECTS`. */
const projectsSync = useProjectsSync()
const { currentUser } = useCurrentUser()
onMounted(() => { projectsSync.load() })
watch(() => currentUser.value.id, () => { projectsSync.load() })
</script>

<template>
  <div class="min-h-screen flex w-full bg-background">
    <!-- Keyboard users reach the page without tabbing through the whole sidebar first. -->
    <a
      href="#konten"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
    >
      Lewati ke konten
    </a>
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <TopHeader />
      <main
        id="konten"
        tabindex="-1"
        class="flex-1 overflow-auto p-4 md:p-6 outline-none"
        :class="isMobile ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''"
      >
        <div
          v-if="projectsSync.state.value.status === 'offline' || projectsSync.state.value.status === 'error'"
          role="status"
          class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          <span>Daftar project belum tersinkron dengan server — yang tampil data lokal. {{ projectsSync.state.value.message }}</span>
          <Button size="sm" variant="outline" @click="projectsSync.load(true)">
            Coba lagi
          </Button>
        </div>
        <slot />
      </main>
    </div>
    <MobileBottomNav v-if="isMobile" />
    <ToastContainer />
  </div>
</template>
