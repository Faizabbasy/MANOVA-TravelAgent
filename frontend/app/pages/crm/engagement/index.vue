<script setup lang="ts">
import FollowUpPanel from '~/components/crm/FollowUpPanel.vue'
import LoyaltyPanel from '~/components/crm/LoyaltyPanel.vue'
import FeedbackPanel from '~/components/crm/FeedbackPanel.vue'

/**
 * CRM > Engagement (Penyederhanaan 7-Role/Menu, revisi "satu menu tanpa tab tapi saling ngalir") — satu
 * menu menampung Follow-up Otomatis (dulu `/crm/follow-ups`), Loyalty Program (dulu `/crm/loyalty`), dan
 * Review & Feedback (dulu `/crm/feedback`). Konten tiap section dipindah apa adanya ke
 * `app/components/crm/*Panel.vue`. Disusun sebagai section bertumpuk dalam satu halaman scroll (BUKAN
 * `<Tabs>`) — tiap section punya `id` untuk deep-link `#section`.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Engagement' })
</script>

<template>
  <div class="space-y-8">
    <PageHeader
      title="Engagement"
      description="Follow-up otomatis, loyalty program, dan review & feedback — dalam satu menu."
      :breadcrumb="[{ label: 'CRM' }, { label: 'Engagement' }]"
    />

    <section id="follow-ups" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Follow-up Otomatis
      </h2>
      <FollowUpPanel />
    </section>

    <Separator />

    <section id="loyalty" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Loyalty Program
      </h2>
      <LoyaltyPanel />
    </section>

    <Separator />

    <section id="feedback" class="space-y-4 scroll-mt-20">
      <h2 class="text-lg font-semibold text-foreground">
        Review & Feedback
      </h2>
      <FeedbackPanel />
    </section>
  </div>
</template>
