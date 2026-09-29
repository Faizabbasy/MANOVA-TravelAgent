<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  Search,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'

const route = useRoute()
const router = useRouter()
const { isCollapsed, toggle } = useSidebar()
const { currentUser } = useCurrentUser()
const { canViewMenu, isRole } = usePermissions()

const handleLogout = () => {
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  router.push('/login')
}

/**
 * Visibilitas menu (Revisi 9-Modul). Urutan: override `RoleMenuGrant` per `item.key` menang, kalau tidak
 * ada mewarisi level modul — keduanya ditangani `canViewMenu()`. Item tanpa `moduleKey` selalu tampil.
 *
 * `item.roles` masih didukung untuk kompatibilitas tapi sudah deprecated; pemeriksaannya lewat `isRole()`
 * supaya role id lama tetap teresolusi ke role hasil penggabungan.
 */
function isNavItemVisible (item: NavItem) {
  if (item.roles) { return isRole(...item.roles) }
  if (!item.moduleKey) { return true }
  return canViewMenu(item.key, item.moduleKey)
}

const allowedItems = computed(() =>
  NAV_ITEMS
    .filter(isNavItemVisible)
    .map(item => ({ ...item, children: item.children?.filter(isNavItemVisible) }))
    /** Grup yang seluruh anaknya tercabut lewat menu grant tidak perlu tampil sebagai induk kosong. */
    .filter(item => !item.children || item.children.length > 0)
)

/**
 * Refinement UI: kolom "Search anything..." sebelumnya tidak terhubung ke apa pun — murni UI mati yang
 * memancing pengguna mengetik lalu tidak terjadi apa-apa. Kini ia menyaring navigasi: dengan 9 modul dan
 * puluhan sub-menu, mengetik "opex" jauh lebih cepat daripada membuka grup satu per satu.
 */
const searchQuery = ref('')
const isSearching = computed(() => searchQuery.value.trim().length > 0)

const visibleItems = computed(() => {
  if (!isSearching.value) { return allowedItems.value }

  const query = searchQuery.value.trim().toLowerCase()
  const matches = (label: string) => label.toLowerCase().includes(query)

  return allowedItems.value
    .map((item) => {
      const matchedChildren = item.children?.filter(child => matches(child.label))
      /** Induk yang cocok tetap menampilkan seluruh anaknya; kalau tidak, hanya anak yang cocok. */
      if (matches(item.label)) { return { ...item, children: item.children } }
      if (matchedChildren?.length) { return { ...item, children: matchedChildren } }
      return undefined
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

const hasResults = computed(() => visibleItems.value.length > 0)

/**
 * Bug sidebar (Penyederhanaan 7-Role/Menu) — perbandingan lama `route.path === to` gagal untuk item
 * ber-query (`to` mengandung `?tab=...`, dipakai pola tab-container `/finance/invoices?tab=...`):
 * `route.path` tidak pernah sama persis dengan string yang mengandung query, jadi item semacam itu TIDAK
 * PERNAH ter-highlight. Sekarang bandingkan base path (`to` sebelum `?`) lebih dulu, lalu — kalau `to`
 * membawa `tab` — cocokkan juga `route.query.tab` supaya highlight tab tetap akurat.
 */
function isActive (to: string) {
  const [base, queryString] = to.split('?')
  if (route.path !== base) { return false }
  if (!queryString) { return true }
  const tab = new URLSearchParams(queryString).get('tab')
  if (tab === null) { return true }
  return route.query.tab === tab
}
const isSectionActive = (item: NavItem) =>
  isActive(item.to) || Boolean(item.children?.some(child => isActive(child.to)))

/** Di-key dengan `item.key` (bukan label) — label kini bisa berubah tanpa mereset state expand. */
const expanded = reactive<Record<string, boolean>>({})
function isExpanded (item: NavItem) {
  /** Saat mencari, seluruh grup dibuka agar hasil pencarian langsung terlihat tanpa klik tambahan. */
  if (isSearching.value) { return true }
  if (item.key in expanded) { return expanded[item.key] }
  return isSectionActive(item)
}
function toggleExpanded (item: NavItem) {
  expanded[item.key] = !isExpanded(item)
}
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <aside
      :class="cn(
        'bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out overflow-hidden',
        isCollapsed ? 'w-16' : 'w-64'
      )"
    >
      <!-- Logo + Toggle -->
      <div
        class="h-16 flex items-center border-b border-border shrink-0"
        :class="isCollapsed ? 'justify-center px-0' : 'px-4 gap-2'"
      >
        <div v-if="!isCollapsed" class="flex items-center gap-2 flex-1 min-w-0">
          <div class="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden bg-white shrink-0">
            <img src="/logo-sweet-escape.jpg" alt="Sweet Escape" class="h-full w-full object-cover scale-150">
          </div>
          <span class="text-lg font-bold text-foreground tracking-tight truncate">MANOVA</span>
        </div>
        <div v-else class="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden bg-white shrink-0">
          <img src="/logo-sweet-escape.jpg" alt="Sweet Escape" class="h-full w-full object-cover scale-150">
        </div>
        <button
          :class="cn(
            'p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0',
            isCollapsed && 'mx-auto'
          )"
          :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggle"
        >
          <PanelLeftClose v-if="!isCollapsed" class="h-5 w-5" />
          <PanelLeftOpen v-else class="h-5 w-5" />
        </button>
      </div>

      <!-- Search -->
      <div v-if="!isCollapsed" class="px-3 py-3 shrink-0">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Cari menu..."
            class="h-9 border-0 bg-muted/60 pl-9 pr-8 text-sm"
          />
          <button
            v-if="isSearching"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Bersihkan pencarian"
            @click="searchQuery = ''"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div v-else class="px-3 py-4 shrink-0">
        <Tooltip>
          <TooltipTrigger as-child>
            <button class="w-full flex justify-center p-2 rounded-lg hover:bg-muted transition-colors">
              <Search class="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Search
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto pb-4" :class="isCollapsed ? 'px-2' : 'px-3'">
        <ul class="space-y-1">
          <li v-for="item in visibleItems" :key="item.key">
            <!-- Collapsed: icon only with tooltip -->
            <Tooltip v-if="isCollapsed">
              <TooltipTrigger as-child>
                <NuxtLink
                  :to="item.to"
                  :class="cn(
                    'flex items-center justify-center p-2 rounded-lg transition-colors',
                    isSectionActive(item)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                  )"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                </NuxtLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                {{ item.label }}
              </TooltipContent>
            </Tooltip>

            <!-- Expanded: full link, with optional nested children -->
            <template v-else>
              <div class="flex items-center gap-1">
                <!--
                  Refinement UI: sebelumnya induk memakai `isSectionActive` sehingga ikut menyala penuh
                  ketika anaknya aktif — dua baris tersorot sekaligus dan sulit tahu mana halaman yang
                  sedang dibuka. Kini sorotan penuh hanya untuk rute induk itu sendiri; bila yang aktif
                  adalah anaknya, induk cukup menebal.
                -->
                <NuxtLink
                  :to="item.to"
                  :class="cn(
                    'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive(item.to)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : isSectionActive(item)
                        ? 'text-foreground font-semibold hover:bg-muted'
                        : 'text-sidebar-foreground font-medium hover:bg-muted hover:text-foreground'
                  )"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                  <span class="flex-1">{{ item.label }}</span>
                  <StatusBadge v-if="item.comingSoon" label="Segera" tone="warning" />
                  <StatusBadge v-else-if="item.isNew" label="Baru" tone="success" />
                </NuxtLink>
                <button
                  v-if="item.children?.length"
                  class="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  @click="toggleExpanded(item)"
                >
                  <ChevronDown :class="cn('h-3.5 w-3.5 transition-transform', isExpanded(item) && 'rotate-180')" />
                </button>
              </div>

              <ul v-if="item.children?.length && isExpanded(item)" class="mt-1 ml-6 space-y-1 border-l border-border pl-3">
                <li v-for="child in item.children" :key="child.key">
                  <NuxtLink
                    :to="child.to"
                    :class="cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                      isActive(child.to)
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                    )"
                  >
                    <span class="flex-1">{{ child.label }}</span>
                    <StatusBadge v-if="child.comingSoon" label="Segera" tone="warning" />
                    <StatusBadge v-else-if="child.isNew" label="Baru" tone="success" />
                  </NuxtLink>
                </li>
              </ul>
            </template>
          </li>
        </ul>

        <p v-if="!isCollapsed && isSearching && !hasResults" class="px-3 py-6 text-center text-sm text-muted-foreground">
          Tidak ada menu yang cocok dengan "{{ searchQuery }}".
        </p>
      </nav>

      <!-- User Profile -->
      <div class="p-3 border-t border-border shrink-0">
        <!-- Collapsed: avatar only with tooltip -->
        <Tooltip v-if="isCollapsed">
          <TooltipTrigger as-child>
            <Popover>
              <PopoverTrigger as-child>
                <button class="w-full flex justify-center p-1 rounded-lg hover:bg-muted transition-colors">
                  <Avatar class="h-8 w-8">
                    <AvatarFallback>{{ currentUser.name.slice(0, 2).toUpperCase() }}</AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-56 p-0" align="end" side="top" :side-offset="8">
                <div class="p-2">
                  <div class="px-2 py-2">
                    <p class="text-sm font-medium text-foreground">
                      {{ currentUser.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ currentUser.email }}
                    </p>
                  </div>
                  <Separator class="my-2" />
                  <button
                    class="flex items-center gap-2 w-full px-2 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
                    @click="() => router.push('/settings')"
                  >
                    <User class="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    class="flex items-center gap-2 w-full px-2 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
                    @click="handleLogout"
                  >
                    <LogOut class="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </TooltipTrigger>
          <TooltipContent side="right">
            {{ currentUser.name }}
          </TooltipContent>
        </Tooltip>

        <!-- Expanded: full profile -->
        <Popover v-else>
          <PopoverTrigger as-child>
            <div class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
              <Avatar class="h-8 w-8">
                <AvatarFallback>{{ currentUser.name.slice(0, 2).toUpperCase() }}</AvatarFallback>
              </Avatar>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-foreground truncate">
                  {{ currentUser.name }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ currentUser.email }}
                </p>
              </div>
              <ChevronDown class="h-4 w-4 text-muted-foreground" />
            </div>
          </PopoverTrigger>
          <PopoverContent class="w-56 p-0" align="end" side="top" :side-offset="8">
            <div class="p-2">
              <div class="px-2 py-2">
                <p class="text-sm font-medium text-foreground">
                  {{ currentUser.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ currentUser.email }}
                </p>
              </div>
              <Separator class="my-2" />
              <button
                class="flex items-center gap-2 w-full px-2 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
                @click="() => router.push('/settings')"
              >
                <User class="h-4 w-4" />
                Profile Settings
              </button>
              <button
                class="flex items-center gap-2 w-full px-2 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
                @click="handleLogout"
              >
                <LogOut class="h-4 w-4" />
                Logout
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  </TooltipProvider>
</template>
