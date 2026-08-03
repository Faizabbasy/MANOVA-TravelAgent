<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  Search,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { NAV_ITEMS, type NavItem } from '~/constants/navigation'

const route = useRoute()
const router = useRouter()
const { isCollapsed, toggle } = useSidebar()
const { currentUser, currentRole } = useCurrentUser()
const { canView } = usePermissions()

const handleLogout = () => {
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  router.push('/login')
}

/** `roles` (Prompt 19) — narrow override, dicek DULU (menggantikan `moduleKey`) bila diisi; selain itu perilaku identik sebelumnya. */
function isNavItemVisible (item: NavItem) {
  if (item.roles) { return item.roles.includes(currentRole.value) }
  return !item.moduleKey || canView(item.moduleKey)
}

const visibleItems = computed(() =>
  NAV_ITEMS.filter(isNavItemVisible).map(item => ({
    ...item,
    children: item.children?.filter(isNavItemVisible)
  }))
)

const isActive = (to: string) => route.path === to
const isSectionActive = (item: NavItem) =>
  route.path === item.to || Boolean(item.children?.some(child => route.path === child.to))

const expanded = reactive<Record<string, boolean>>({})
function isExpanded (item: NavItem) {
  if (item.label in expanded) { return expanded[item.label] }
  return isSectionActive(item)
}
function toggleExpanded (item: NavItem) {
  expanded[item.label] = !isExpanded(item)
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
      <div v-if="!isCollapsed" class="px-4 py-4 shrink-0">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search anything..."
            class="pl-9 bg-muted/50 border-0 h-9 text-sm"
          />
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
          <li v-for="item in visibleItems" :key="item.label">
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
                <NuxtLink
                  :to="item.to"
                  :class="cn(
                    'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isSectionActive(item)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                  )"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                  <span class="flex-1">{{ item.label }}</span>
                  <StatusBadge v-if="item.comingSoon" label="Segera" tone="warning" />
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
                <li v-for="child in item.children" :key="child.label">
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
                  </NuxtLink>
                </li>
              </ul>
            </template>
          </li>
        </ul>
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
