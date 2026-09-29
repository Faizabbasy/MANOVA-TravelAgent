<script setup lang="ts">
import { computed } from 'vue'
import { PanelLeft } from 'lucide-vue-next'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'
import { RANK, getMenuLevel } from '~/data/rbac'
import type { RoleDefinition } from '~/types/rbac'

const props = defineProps<{ role: RoleDefinition }>()

/**
 * Pratinjau sidebar untuk role terpilih — menerapkan aturan visibilitas yang PERSIS sama dengan
 * `AppSidebar.vue`, sehingga admin bisa memverifikasi hasil konfigurasinya tanpa harus berpindah user.
 */
function isVisible (item: NavItem) {
  if (!item.moduleKey) { return true }
  return RANK[getMenuLevel(props.role.id, item.key, item.moduleKey)] >= RANK.VIEW
}

const visibleItems = computed(() =>
  NAV_ITEMS
    .filter(isVisible)
    .map(item => ({ ...item, children: item.children?.filter(isVisible) }))
    .filter(item => !item.children || item.children.length > 0)
)

const totalVisible = computed(() =>
  visibleItems.value.reduce((total, item) => total + 1 + (item.children?.length ?? 0), 0))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <PanelLeft class="h-4 w-4 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">
        Tampilan sidebar untuk <span class="font-medium text-foreground">{{ role.label }}</span> —
        {{ totalVisible }} entri terlihat.
      </p>
    </div>

    <div class="rounded-lg border border-border bg-card p-3 max-w-xs">
      <ul class="space-y-0.5">
        <li v-for="item in visibleItems" :key="item.key">
          <div class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-foreground">
            <component :is="item.icon" class="h-4 w-4 text-muted-foreground shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </div>
          <ul v-if="item.children?.length" class="ml-6 border-l border-border pl-2.5 space-y-0.5">
            <li
              v-for="child in item.children"
              :key="child.key"
              class="px-2 py-1 text-xs text-muted-foreground truncate"
            >
              {{ child.label }}
            </li>
          </ul>
        </li>
      </ul>

      <EmptyState
        v-if="!visibleItems.length"
        title="Sidebar kosong"
        description="Role ini belum punya akses modul apa pun."
      />
    </div>
  </div>
</template>
