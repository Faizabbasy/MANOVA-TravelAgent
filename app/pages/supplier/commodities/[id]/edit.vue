<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PackageX } from 'lucide-vue-next'
import { getCommodityProductById, updateCommodityProduct } from '~/data'
import { SERVICE_TYPES } from '~/constants/status'
import type { ServiceTypeKey } from '~/types/project'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const { canView, vendorScopeId } = usePermissions()
const { showToast } = useToast()

const commodity = computed(() => getCommodityProductById(String(route.params.id)))
useHead({ title: computed(() => commodity.value ? `Edit ${commodity.value.name}` : 'Komoditas Tidak Ditemukan') })

const isOwn = computed(() => !!commodity.value && !!vendorScopeId.value && commodity.value.vendorId === vendorScopeId.value)

const name = ref('')
const category = ref<ServiceTypeKey>('hotel')
const description = ref('')
const sellPriceIdr = ref<number | null>(null)
const costPriceIdr = ref<number | null>(null)

/** Prefill form dari data existing (Section 12 checklist: "Edit tidak prefill" adalah masalah yang harus dihindari). */
watch(commodity, (value) => {
  if (!value) { return }
  name.value = value.name
  category.value = value.category
  description.value = value.description ?? ''
  sellPriceIdr.value = value.sellPriceIdr
  costPriceIdr.value = value.costPriceIdr ?? null
}, { immediate: true })

function submit () {
  if (!commodity.value || !name.value.trim() || !sellPriceIdr.value) { return }
  updateCommodityProduct(commodity.value.id, {
    name: name.value.trim(),
    category: category.value,
    description: description.value.trim() || undefined,
    sellPriceIdr: sellPriceIdr.value,
    costPriceIdr: costPriceIdr.value ?? undefined
  })
  showToast('Komoditas Diperbarui', `"${name.value.trim()}" berhasil diperbarui.`, 'success')
  router.push(`/supplier/commodities/${commodity.value.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <template v-if="!commodity || !isOwn">
      <PageHeader title="Komoditas Tidak Ditemukan" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya', to: '/supplier/commodities' }, { label: 'Not Found' }]" />
      <SectionCard>
        <EmptyState :icon="PackageX" title="Komoditas tidak ditemukan" :description="`Komoditas dengan ID '${route.params.id}' tidak ada atau bukan milik company Anda.`">
          <Button @click="router.push('/supplier/commodities')">
            Kembali ke Komoditas Saya
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <RoleAccessState v-else-if="!canView('supplier-portal') || !vendorScopeId" module-label="Supplier Portal" />

    <template v-else-if="commodity.status === 'archived'">
      <PageHeader :title="`Edit ${commodity.name}`" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya', to: '/supplier/commodities' }, { label: commodity.name, to: `/supplier/commodities/${commodity.id}` }, { label: 'Edit' }]" />
      <SectionCard>
        <EmptyState :icon="PackageX" title="Komoditas sudah diarsipkan" description="Komoditas yang sudah diarsipkan tidak dapat diedit lagi.">
          <Button @click="router.push(`/supplier/commodities/${commodity.id}`)">
            Kembali ke Detail
          </Button>
        </EmptyState>
      </SectionCard>
    </template>

    <template v-else>
      <PageHeader :title="`Edit ${commodity.name}`" :breadcrumb="[{ label: 'Supplier Portal', to: '/supplier' }, { label: 'Komoditas Saya', to: '/supplier/commodities' }, { label: commodity.name, to: `/supplier/commodities/${commodity.id}` }, { label: 'Edit' }]" />

      <SectionCard>
        <div class="space-y-4 max-w-lg">
          <div class="space-y-1.5">
            <Label for="edit-name">Nama Komoditas</Label>
            <Input id="edit-name" v-model="name" />
          </div>
          <div class="space-y-1.5">
            <Label for="edit-category">Kategori</Label>
            <select id="edit-category" v-model="category" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option v-for="type in SERVICE_TYPES" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="edit-description">Deskripsi (opsional)</Label>
            <Input id="edit-description" v-model="description" />
          </div>
          <div class="space-y-1.5">
            <Label for="edit-sell-price">Harga Jual ke Client (Rp)</Label>
            <CurrencyInput id="edit-sell-price" v-model="sellPriceIdr" />
            <p class="text-xs text-muted-foreground">
              Order yang sudah confirmed TIDAK terpengaruh — harga di order tersimpan sebagai snapshot.
            </p>
          </div>
          <div class="space-y-1.5">
            <Label for="edit-cost-price">Harga Pokok Internal (Rp, opsional)</Label>
            <CurrencyInput id="edit-cost-price" v-model="costPriceIdr" />
          </div>
          <div class="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="outline" @click="router.push(`/supplier/commodities/${commodity.id}`)">
              Batal
            </Button>
            <Button :disabled="!name.trim() || !sellPriceIdr" @click="submit">
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
