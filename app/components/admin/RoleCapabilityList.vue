<script setup lang="ts">
import { computed } from 'vue'
import { CAPABILITIES } from '~/constants/capabilities'
import { hasCapability } from '~/data/rbac'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{
  role: RoleDefinition
  canManage: boolean
}>()

const emit = defineEmits<{
  toggle: [payload: { capabilityKey: string; granted: boolean }]
}>()

const isLocked = computed(() => props.role.isSuperAdmin || !props.canManage)

const groups = computed(() => {
  const byGroup = new Map<string, { key: string; label: string; description?: string; granted: boolean }[]>()
  for (const capability of CAPABILITIES) {
    const list = byGroup.get(capability.group) ?? []
    list.push({ ...capability, granted: hasCapability(props.role.id, capability.key) })
    byGroup.set(capability.group, list)
  }
  return [...byGroup.entries()].map(([label, items]) => ({ label, items }))
})

const grantedCount = computed(() => groups.value.reduce((total, group) => total + group.items.filter(item => item.granted).length, 0))
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p class="text-sm text-foreground">
        <span class="font-medium">{{ grantedCount }}</span> dari {{ CAPABILITIES.length }} action flag aktif.
      </p>
      <p class="text-xs text-muted-foreground mt-1">
        Action flag menggerbangi aksi spesifik di dalam halaman yang terlalu halus untuk diwakili level modul —
        misalnya siapa yang boleh menutup Project Order atau melihat margin internal. Tanpa ini, gerbang tsb
        hanya bisa dipegang role bawaan.
      </p>
    </div>

    <div v-if="role.isSuperAdmin" class="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-foreground">
      {{ role.label }} memegang seluruh action flag secara otomatis.
    </div>

    <div v-for="group in groups" :key="group.label" class="rounded-lg border border-border overflow-hidden">
      <div class="px-4 py-2.5 bg-muted/40 border-b border-border">
        <span class="text-sm font-medium text-foreground">{{ group.label }}</span>
      </div>
      <ul class="divide-y divide-border">
        <li v-for="capability in group.items" :key="capability.key">
          <label class="flex items-start gap-3 px-4 py-2.5" :class="isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-muted/30'">
            <Checkbox
              :model-value="role.isSuperAdmin ? true : capability.granted"
              :disabled="isLocked"
              class="mt-0.5"
              @update:model-value="value => emit('toggle', { capabilityKey: capability.key, granted: Boolean(value) })"
            />
            <span class="min-w-0">
              <span class="block text-sm text-foreground">{{ capability.label }}</span>
              <span v-if="capability.description" class="block text-xs text-muted-foreground">{{ capability.description }}</span>
              <span class="block text-[11px] text-muted-foreground font-mono truncate">{{ capability.key }}</span>
            </span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>
