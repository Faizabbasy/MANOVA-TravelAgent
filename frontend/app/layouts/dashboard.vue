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
      <main id="konten" tabindex="-1" class="flex-1 overflow-auto p-4 md:p-6 outline-none">
        <slot />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>
