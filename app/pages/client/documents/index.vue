<script setup lang="ts">
import DocumentsListPanel from '~/components/client/DocumentsListPanel.vue'
import MessagesListPanel from '~/components/client/MessagesListPanel.vue'
import SupportListPanel from '~/components/client/SupportListPanel.vue'

/**
 * Client Portal > Documents & Support (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi
 * saling ngalir") — satu menu menampung Documents (dulu halaman ini sendiri), Messages & Activities (dulu
 * `/client/messages`), dan Issues & Support (dulu `/client/support`). Konten tiap section dipindah apa
 * adanya ke `app/components/client/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman
 * scroll (BUKAN `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`. Route detail
 * (`/client/messages/[projectId]`, `/client/support/[id]`) TIDAK berubah.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Documents & Support' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Documents & Support"
      description="Pusat dokumen, percakapan, dan tiket bantuan lintas seluruh Project Order Anda."
      :breadcrumb="[{ label: 'Client Portal', to: '/client' }, { label: 'Documents & Support' }]"
    />

    <section id="documents" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Documents
      </h2>
      <DocumentsListPanel />
    </section>

    <Separator />

    <section id="messages" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Messages
      </h2>
      <MessagesListPanel />
    </section>

    <Separator />

    <section id="support" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Support
      </h2>
      <SupportListPanel />
    </section>
  </div>
</template>
