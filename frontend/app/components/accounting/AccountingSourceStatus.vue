<script setup lang="ts">
const props = defineProps<{ sourceType: string; sourceId: string }>()
const api = useApi()
const session = useServerSession()
const status = useFinanceQuery(async () => {
  const sourceType = props.sourceType
  const sourceId = props.sourceId
  return { sourceType, sourceId, result: (await api.accounting.sourceStatus(sourceType, sourceId)).data }
}, {
  watch: [() => props.sourceType, () => props.sourceId], enabled: () => session.can('accounting.view-posting-detail') && !!props.sourceId
})
const current = computed(() => status.data.value?.sourceId === props.sourceId && status.data.value?.sourceType === props.sourceType ? status.data.value.result : null)
</script>

<template>
  <section v-if="session.can('accounting.view-posting-detail')" class="space-y-2 rounded-lg border p-3 text-sm" aria-label="Accounting transaksi">
    <h3 class="font-medium">
      Accounting dari transaksi ini
    </h3>
    <FinanceErrorState v-if="status.error.value" :error="status.error.value" compact @retry="status.refresh" />
    <p v-else-if="!current" role="status">
      Memuat status…
    </p>
    <template v-else>
      <p v-if="current.basis === 'rehearsal'" class="font-medium">
        Rehearsal · bukan buku produksi
      </p>
      <p class="text-muted-foreground">
        {{ current.message }}
      </p>
      <ul class="space-y-1">
        <li v-for="id in current.journals" :key="id">
          <NuxtLink :to="`/finance/accounting/journals/${id}`" class="underline">
            Periksa jurnal {{ id }}
          </NuxtLink>
        </li>
      </ul>
    </template>
  </section>
</template>
