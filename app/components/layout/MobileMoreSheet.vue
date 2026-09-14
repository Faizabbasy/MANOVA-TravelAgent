<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, LogOut, User } from 'lucide-vue-next'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'
import { getVisibleNavItems } from '~/utils/nav-visibility'
import { isNavPathActive } from '~/utils/nav-active'
import { useMobileTabs } from '~/composables/useMobileTabs'

const open = defineModel<boolean>('open', { default: false })

const route = useRoute()
const router = useRouter()
const { currentUser } = useCurrentUser()
const { canViewMenu, isRole } = usePermissions()
const { tabs } = useMobileTabs()

/** Menu lengkap dikurangi 4 yang sudah dipin di bottom bar — supaya tidak duplikat. */
const pinnedKeys = computed(() => new Set(tabs.value.map(tab => tab.key)))

function flattenForMore (items: NavItem[]): NavItem[] {
  return items.flatMap((item) => {
    if (item.children?.length) {
      return item.children.filter(child => !pinnedKeys.value.has(child.key))
    }
    return pinnedKeys.value.has(item.key) ? [] : [item]
  })
}

const moreItems = computed(() =>
  flattenForMore(getVisibleNavItems(NAV_ITEMS, { isRole, canViewMenu }))
)

function isActive (to: string) {
  return isNavPathActive(to, route)
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
          <li v-for="item in moreItems" :key="item.key">
            <button
              class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors"
              :class="isActive(item.to) ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold' : 'text-foreground hover:bg-muted'"
              @click="goTo(item.to)"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              <span class="flex-1">{{ item.label }}</span>
              <ChevronRight class="h-4 w-4 text-muted-foreground" />
            </button>
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
