<script setup lang="ts">
import { computed } from 'vue'
import { LogIn, UserCheck, UserX } from 'lucide-vue-next'
import { getUserById } from '~/data'
import { getSessionLogs, getSessionDurationMinutes } from '~/data/session-logs'
import { formatDateTime } from '~/utils/format'
import { ROLES } from '~/constants/roles'
import { findStatusOption } from '~/constants/status'

/**
 * Administration > Log Session — audit trail login/logout user. Sengaja TIDAK ditambahkan ke `NAV_ITEMS`
 * (sidebar sedang disederhanakan, lihat komentar di `app/constants/navigation.ts`) — route ini tetap hidup
 * dan tergerbang RBAC lewat `HIDDEN_NAV_ROUTES`, diakses langsung mis. dari link di Audit & Activity.
 */
definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Log Session' })

const { canView } = usePermissions()
const hasAccess = computed(() => canView('administration'))

const logs = computed(() => getSessionLogs())
const activeCount = computed(() => logs.value.filter(log => log.status === 'active').length)

function userLabel (userId: string): string {
  const user = getUserById(userId)
  if (!user) { return userId }
  const roleLabel = findStatusOption(ROLES.value, user.role).label
  return `${user.name} (${roleLabel})`
}

function durationLabel (log: ReturnType<typeof getSessionLogs>[number]): string {
  const minutes = getSessionDurationMinutes(log)
  if (minutes === null) { return 'Sedang berlangsung' }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} jam ${rest} menit` : `${rest} menit`
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Log Session"
      description="Audit trail login/logout user — kapan masuk, kapan keluar, dari IP dan perangkat mana."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Log Session' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul Administration" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard title="Total Sesi" :value="String(logs.length)" :icon="LogIn" icon-color="primary" />
        <StatsCard title="Sesi Aktif" :value="String(activeCount)" :icon="UserCheck" :icon-color="activeCount > 0 ? 'success' : 'warning'" />
        <StatsCard title="Sesi Berakhir" :value="String(logs.length - activeCount)" :icon="UserX" icon-color="warning" />
      </div>

      <SectionCard description="Diurutkan dari login terbaru. Sesi tanpa waktu logout berarti user masih aktif.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Logout</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Perangkat</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="log in logs" :key="log.id">
              <TableCell class="text-sm font-medium text-foreground whitespace-nowrap">
                {{ userLabel(log.userId) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground whitespace-nowrap">
                {{ formatDateTime(log.loginAt) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground whitespace-nowrap">
                {{ log.logoutAt ? formatDateTime(log.logoutAt) : '—' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground whitespace-nowrap">
                {{ durationLabel(log) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground font-mono">
                {{ log.ipAddress }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ log.device }}
              </TableCell>
              <TableCell>
                <StatusBadge
                  :label="log.status === 'active' ? 'Aktif' : 'Berakhir'"
                  :tone="log.status === 'active' ? 'success' : 'neutral'"
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>
    </template>
  </div>
</template>
