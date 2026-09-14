<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell, Clock, Zap, Power, MessageCircle, Mail, Phone, ExternalLink } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import {
  FOLLOW_UP_RULES,
  FOLLOW_UP_CHANNEL_LABEL,
  getFollowUpTasks,
  toggleFollowUpRule,
  buildWhatsAppLink
} from '~/data/crm-engagement'
import { formatDate } from '~/utils/format'
import { DEMO_REFERENCE_DATE } from '~/utils/attention'
import type { FollowUpChannel } from '~/types/crm-engagement'

/** Tab "Follow-up" — Menu CRM > Engagement (Penyederhanaan 7-Role/Menu). Dulu `/crm/follow-ups`, kini
 * tab dalam satu menu bersama Loyalty/Review & Feedback — logika tidak diubah. */

const { canView, can } = usePermissions()
const { showToast } = useToast()

const hasAccess = computed(() => canView('crm'))
const canManage = computed(() => can('crm.manage-follow-up'))

const refreshKey = ref(0)
const channelFilter = ref<'all' | FollowUpChannel>('all')
const dueOnly = ref(true)

const tasks = computed(() => {
  void refreshKey.value
  return getFollowUpTasks()
})

const filteredTasks = computed(() => {
  let result = tasks.value
  if (channelFilter.value !== 'all') { result = result.filter(task => task.channel === channelFilter.value) }
  if (dueOnly.value) { result = result.filter(task => task.status === 'due') }
  return result
})

const stats = computed(() => ({
  due: tasks.value.filter(task => task.status === 'due').length,
  overdue: tasks.value.filter(task => task.overdueDays > 7).length,
  upcoming: tasks.value.filter(task => task.status === 'upcoming').length,
  activeRules: FOLLOW_UP_RULES.filter(rule => rule.isActive).length
}))

const CHANNEL_ICON: Record<FollowUpChannel, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone
}

function onToggleRule (ruleId: string) {
  const rule = toggleFollowUpRule(ruleId)
  refreshKey.value += 1
  if (rule) {
    showToast('Rule diperbarui', `"${rule.name}" ${rule.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success')
  }
}

function contactLink (task: { channel: FollowUpChannel; phone?: string; email?: string; message: string }): string | undefined {
  if (task.channel === 'whatsapp') { return buildWhatsAppLink(task.phone, task.message) }
  if (task.channel === 'email' && task.email) { return `mailto:${task.email}?body=${encodeURIComponent(task.message)}` }
  if (task.channel === 'phone' && task.phone) { return `tel:${task.phone.replace(/\s/g, '')}` }
  return undefined
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!hasAccess" module-label="modul CRM" />

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Jatuh Tempo Hari Ini" :value="String(stats.due)" :icon="Bell" :icon-color="stats.due ? 'warning' : 'success'" />
        <StatsCard title="Telat > 7 Hari" :value="String(stats.overdue)" :icon="Clock" :icon-color="stats.overdue ? 'destructive' : 'success'" />
        <StatsCard title="Akan Datang" :value="String(stats.upcoming)" :icon="Clock" />
        <StatsCard title="Rule Aktif" :value="`${stats.activeRules}/${FOLLOW_UP_RULES.length}`" :icon="Zap" icon-color="primary" />
      </div>

      <SectionCard
        title="Rule Follow-up"
        description="Setiap rule memicu task otomatis sekian hari setelah kejadian sumbernya."
      >
        <ResponsiveDataView :items="FOLLOW_UP_RULES" :get-key="rule => rule.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Pemicu</TableHead>
                  <TableHead>Jeda</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead class="text-right">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="rule in items" :key="rule.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ rule.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ rule.description }}
                    </p>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground">
                    {{ rule.trigger }}
                  </TableCell>
                  <TableCell class="text-sm text-foreground">
                    +{{ rule.offsetDays }} hari
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-1.5">
                      <component :is="CHANNEL_ICON[rule.channel]" class="h-3.5 w-3.5 text-muted-foreground" />
                      <span class="text-sm text-foreground">{{ FOLLOW_UP_CHANNEL_LABEL[rule.channel] }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right">
                    <Button v-if="canManage" variant="outline" size="sm" @click="onToggleRule(rule.id)">
                      <Power class="h-3.5 w-3.5 mr-1.5" />
                      {{ rule.isActive ? 'Nonaktifkan' : 'Aktifkan' }}
                    </Button>
                    <StatusBadge v-else :label="rule.isActive ? 'Aktif' : 'Nonaktif'" :tone="rule.isActive ? 'success' : 'neutral'" />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: rule }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ rule.name }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    {{ rule.description }}
                  </p>
                </div>
                <Button v-if="canManage" variant="outline" size="sm" @click="onToggleRule(rule.id)">
                  <Power class="h-3.5 w-3.5 mr-1.5" />
                  {{ rule.isActive ? 'Nonaktifkan' : 'Aktifkan' }}
                </Button>
                <StatusBadge v-else :label="rule.isActive ? 'Aktif' : 'Nonaktif'" :tone="rule.isActive ? 'success' : 'neutral'" />
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Pemicu
                  </p>
                  <p class="text-foreground">
                    {{ rule.trigger }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground">
                    Jeda
                  </p>
                  <p class="text-foreground">
                    +{{ rule.offsetDays }} hari
                  </p>
                </div>
                <div class="col-span-2 flex items-center gap-1.5">
                  <component :is="CHANNEL_ICON[rule.channel]" class="h-3.5 w-3.5 text-muted-foreground" />
                  <span class="text-foreground">{{ FOLLOW_UP_CHANNEL_LABEL[rule.channel] }}</span>
                </div>
              </div>
            </div>
          </template>
        </ResponsiveDataView>
      </SectionCard>

      <SectionCard>
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-base font-semibold text-foreground">
              Antrean Follow-up
            </h3>
            <p class="text-xs text-muted-foreground mt-0.5">
              Dihitung terhadap tanggal acuan demo {{ formatDate(DEMO_REFERENCE_DATE) }}.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <Checkbox v-model="dueOnly" />
              Hanya yang jatuh tempo
            </label>
            <select v-model="channelFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="all">
                Semua Kanal
              </option>
              <option v-for="(label, key) in FOLLOW_UP_CHANNEL_LABEL" :key="key" :value="key">
                {{ label }}
              </option>
            </select>
          </div>
        </div>

        <ResponsiveDataView v-if="filteredTasks.length" :items="filteredTasks" :get-key="task => task.id">
          <template #desktop="{ items }">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Pesan Siap Kirim</TableHead>
                  <TableHead class="text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="task in items" :key="task.id">
                  <TableCell>
                    <p class="text-sm font-medium text-foreground">
                      {{ task.contactName }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ task.companyName ?? '—' }}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-1.5">
                      <component :is="CHANNEL_ICON[task.channel]" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span class="text-sm text-foreground">{{ task.ruleName }}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p class="text-sm text-foreground">
                      {{ formatDate(task.dueDate) }}
                    </p>
                    <p
                      :class="cn('text-xs', task.overdueDays > 0 ? 'text-destructive font-medium' : 'text-muted-foreground')"
                    >
                      {{ task.overdueDays > 0 ? `telat ${task.overdueDays} hari` : `${Math.abs(task.overdueDays)} hari lagi` }}
                    </p>
                  </TableCell>
                  <TableCell class="max-w-sm">
                    <p class="text-xs text-muted-foreground line-clamp-2">
                      {{ task.message }}
                    </p>
                  </TableCell>
                  <TableCell class="text-right">
                    <a v-if="contactLink(task)" :href="contactLink(task)" target="_blank" rel="noopener">
                      <Button size="sm" :variant="task.channel === 'whatsapp' ? 'default' : 'outline'">
                        <ExternalLink class="h-3.5 w-3.5 mr-1.5" />
                        {{ FOLLOW_UP_CHANNEL_LABEL[task.channel] }}
                      </Button>
                    </a>
                    <span v-else class="text-xs text-muted-foreground">Kontak belum lengkap</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </template>

          <template #mobile-card="{ item: task }">
            <div class="rounded-xl border border-border bg-card p-4">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-foreground truncate">
                    {{ task.contactName }}
                  </p>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ task.companyName ?? '—' }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <component :is="CHANNEL_ICON[task.channel]" class="h-3.5 w-3.5 text-muted-foreground" />
                  <span class="text-xs text-foreground">{{ task.ruleName }}</span>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p class="text-muted-foreground">
                    Jatuh Tempo
                  </p>
                  <p class="text-foreground">
                    {{ formatDate(task.dueDate) }}
                  </p>
                  <p :class="cn('text-xs', task.overdueDays > 0 ? 'text-destructive font-medium' : 'text-muted-foreground')">
                    {{ task.overdueDays > 0 ? `telat ${task.overdueDays} hari` : `${Math.abs(task.overdueDays)} hari lagi` }}
                  </p>
                </div>
                <div class="col-span-2">
                  <p class="text-muted-foreground">
                    Pesan Siap Kirim
                  </p>
                  <p class="text-foreground line-clamp-2">
                    {{ task.message }}
                  </p>
                </div>
              </div>
              <div class="mt-3">
                <a v-if="contactLink(task)" :href="contactLink(task)" target="_blank" rel="noopener" class="block">
                  <Button size="sm" class="w-full" :variant="task.channel === 'whatsapp' ? 'default' : 'outline'">
                    <ExternalLink class="h-3.5 w-3.5 mr-1.5" />
                    {{ FOLLOW_UP_CHANNEL_LABEL[task.channel] }}
                  </Button>
                </a>
                <span v-else class="text-xs text-muted-foreground">Kontak belum lengkap</span>
              </div>
            </div>
          </template>
        </ResponsiveDataView>

        <EmptyState
          v-else
          :icon="Bell"
          title="Tidak ada follow-up"
          description="Semua kontak sudah tertangani untuk filter yang dipilih."
        />
      </SectionCard>
    </template>
  </div>
</template>
