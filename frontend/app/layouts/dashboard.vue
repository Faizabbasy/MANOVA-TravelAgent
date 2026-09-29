<template>
  <div class="min-h-screen flex w-full bg-background">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <TopHeader />
      <main class="flex-1 overflow-auto p-4 md:p-6">
        <slot />
      </main>
    </div>
    <ToastContainer />
  </div>
</template>
