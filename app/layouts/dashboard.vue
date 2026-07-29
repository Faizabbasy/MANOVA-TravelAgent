<template>
  <div class="min-h-screen flex w-full bg-background">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <TopHeader />
      <main class="flex-1 p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
