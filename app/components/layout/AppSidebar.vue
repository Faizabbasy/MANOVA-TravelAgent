<script setup lang="ts">
import { cn } from '~/lib/utils'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Receipt,
  FileText,
  Users,
  UserCircle,
  Clock,
  BarChart3,
  FileSpreadsheet,
  Layout,
  Plug,
  Settings,
  Search,
  ChevronDown,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const { isCollapsed, toggle } = useSidebar()

const handleLogout = () => {
  localStorage.removeItem('isAuthenticated')
  localStorage.removeItem('userEmail')
  router.push('/login')
}

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban, badge: 12 },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, badge: 8 },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Files", url: "/files", icon: FileText },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Team", url: "/team", icon: UserCircle },
  { title: "Time Tracking", url: "/time-tracking", icon: Clock },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Invoices", url: "/invoices", icon: FileSpreadsheet },
  { title: "Templates", url: "/templates", icon: Layout },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
]

const isActive = (url: string) => route.path === url
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
      <div class="h-16 flex items-center border-b border-border shrink-0"
        :class="isCollapsed ? 'justify-center px-0' : 'px-4 gap-2'"
      >
        <img
          v-if="!isCollapsed"
          src="/logo.svg"
          alt="Daffascript"
          class="h-8 w-auto flex-1 min-w-0"
        />
        <button
          @click="toggle"
          :class="cn(
            'p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0',
            isCollapsed && 'mx-auto'
          )"
          :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
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
          <kbd class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
            ⌘K
          </kbd>
        </div>
      </div>

      <!-- Search icon (collapsed) -->
      <div v-else class="px-3 py-4 shrink-0">
        <Tooltip>
          <TooltipTrigger as-child>
            <button class="w-full flex justify-center p-2 rounded-lg hover:bg-muted transition-colors">
              <Search class="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Search</TooltipContent>
        </Tooltip>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto pb-4" :class="isCollapsed ? 'px-2' : 'px-3'">
        <ul class="space-y-1">
          <li v-for="item in menuItems" :key="item.title">
            <!-- Collapsed: icon only with tooltip -->
            <Tooltip v-if="isCollapsed">
              <TooltipTrigger as-child>
                <NuxtLink
                  :to="item.url"
                  :class="cn(
                    'flex items-center justify-center p-2 rounded-lg transition-colors',
                    isActive(item.url)
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                  )"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                </NuxtLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                {{ item.title }}
                <span v-if="item.badge" class="ml-1.5 text-xs opacity-70">({{ item.badge }})</span>
              </TooltipContent>
            </Tooltip>

            <!-- Expanded: full link -->
            <NuxtLink
              v-else
              :to="item.url"
              :class="cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive(item.url)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
              )"
            >
              <component :is="item.icon" class="h-4 w-4" />
              <span class="flex-1">{{ item.title }}</span>
              <span
                v-if="item.badge"
                :class="cn(
                  'px-2 py-0.5 text-xs rounded-full',
                  isActive(item.url)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )"
              >
                {{ item.badge }}
              </span>
            </NuxtLink>
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
                    <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" />
                    <AvatarFallback>DP</AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-56 p-0" align="end" side="top" :side-offset="8">
                <div class="p-2">
                  <div class="px-2 py-2">
                    <p class="text-sm font-medium text-foreground">Daffa Prayoga</p>
                    <p class="text-xs text-muted-foreground">daffa@daffascript.com</p>
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
          <TooltipContent side="right">Daffa Prayoga</TooltipContent>
        </Tooltip>

        <!-- Expanded: full profile -->
        <Popover v-else>
          <PopoverTrigger as-child>
            <div class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
              <Avatar class="h-8 w-8">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" />
                <AvatarFallback>DP</AvatarFallback>
              </Avatar>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-foreground truncate">Daffa Prayoga</p>
                <p class="text-xs text-muted-foreground truncate">CEO</p>
              </div>
              <ChevronDown class="h-4 w-4 text-muted-foreground" />
            </div>
          </PopoverTrigger>
          <PopoverContent class="w-56 p-0" align="end" side="top" :side-offset="8">
            <div class="p-2">
              <div class="px-2 py-2">
                <p class="text-sm font-medium text-foreground">Daffa Prayoga</p>
                <p class="text-xs text-muted-foreground">daffa@daffascript.com</p>
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
