<script setup lang="ts">
import { computed, reactive } from 'vue'
import { ChevronDown, ChevronRight, LogOut, User } from 'lucide-vue-next'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'
import { getVisibleNavItems } from '~/utils/nav-visibility'
import { isNavPathActive } from '~/utils/nav-active'
import { useMobileTabs } from '~/composables/useMobileTabs'
import { cn } from '~/lib/utils'

const open = defineModel<boolean>('open', { default: false })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canViewMenu, isRole } = usePermissions()
const { tabs } = useMobileTabs()

/** Menu lengkap dikurangi 4 yang sudah dipin di bottom bar — supaya tidak duplikat. */
const pinnedKeys = computed(() => new Set(tabs.value.map(tab => tab.key)))

/**
 * Sebelumnya anak-anak sub-menu di-flatten jadi satu list rata tanpa induknya, jadi kelihatan acak.
 * Kini dikelompokkan per induk (label + ikon) sama seperti sidebar desktop, supaya konteksnya kebaca.
 */
interface MoreGroup { item: NavItem; children: NavItem[] }

const moreGroups = computed<MoreGroup[]>(() => {
  const items = getVisibleNavItems(NAV_ITEMS, { isRole, canViewMenu })
  const groups: MoreGroup[] = []
  for (const item of items) {
    if (item.children?.length) {
      const children = item.children.filter(child => !pinnedKeys.value.has(child.key))
      if (children.length) { groups.push({ item, children }) }
    } else if (!pinnedKeys.value.has(item.key)) {
      groups.push({ item, children: [] })
    }
  }
  return groups
})

function isActive (to: string) {
  return isNavPathActive(to, route)
}
const isGroupActive = (group: MoreGroup) =>
  isActive(group.item.to) || group.children.some(child => isActive(child.to))

/** Default terbuka di sheet ini (beda dari sidebar) — semua isi grup langsung kebaca tanpa perlu tap dulu. */
const collapsed = reactive<Record<string, boolean>>({})
function isExpanded (group: MoreGroup) {
  return !collapsed[group.item.key]
}
function toggleExpanded (group: MoreGroup) {
  collapsed[group.item.key] = isExpanded(group)
}

function goTo (to: string) {
  open.value = false
  router.push(to)
}

function handleLogout () {
  open.value = false
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  router.push('/login')
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="bottom" class="md:hidden max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
      <SheetHeader class="px-4 pt-4 pb-2 text-left">
        <SheetTitle>Menu Lainnya</SheetTitle>
      </SheetHeader>

      <nav class="px-3 pb-2">
        <ul class="space-y-1">
          <li v-for="group in moreGroups" :key="group.item.key">
            <button
              class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors"
              :class="isGroupActive(group) ? 'text-sidebar-accent-foreground' : 'text-foreground hover:bg-muted'"
              @click="group.children.length ? toggleExpanded(group) : goTo(group.item.to)"
            >
              <component :is="group.item.icon" class="h-4 w-4 shrink-0" />
              <span class="flex-1">{{ group.item.label }}</span>
              <ChevronRight v-if="!group.children.length" class="h-4 w-4 text-muted-foreground" />
              <ChevronDown
                v-else
                :class="cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded(group) && 'rotate-180')"
              />
            </button>

            <ul v-if="group.children.length && isExpanded(group)" class="mb-1 ml-6 space-y-0.5 border-l border-border pl-3">
              <li v-for="child in group.children" :key="child.key">
                <button
                  class="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors"
                  :class="isActive(child.to) ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'"
                  @click="goTo(child.to)"
                >
                  {{ child.label }}
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </nav>

      <Separator />

      <div class="p-3">
        <div class="px-2 py-2">
          <p class="text-sm font-medium text-foreground">
            {{ currentUser.name }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ currentUser.email }}
          </p>
        </div>
        <button
          class="flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-sm transition-colors hover:bg-muted"
          @click="goTo('/settings')"
        >
          <User class="h-4 w-4" />
          Profile Settings
        </button>
        <button
          class="flex w-full items-center gap-2 rounded-md px-2 py-3 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          @click="handleLogout"
        >
          <LogOut class="h-4 w-4" />
          Logout
        </button>
      </div>
    </SheetContent>
  </Sheet>
</template>
