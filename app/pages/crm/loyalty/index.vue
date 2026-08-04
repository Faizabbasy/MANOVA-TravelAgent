<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award, Coins, TrendingUp, Plus } from 'lucide-vue-next'
import { cn } from '~/lib/utils'
import { LOYALTY_TIERS, getLoyaltyLeaderboard, getLoyaltyAdjustments, addLoyaltyAdjustment } from '~/data/crm-engagement'
import { getUserById } from '~/data'
import { formatCurrencyIdr, formatNumber, formatDate } from '~/utils/format'
import type { BadgeTone } from '~/types/common'
import type { LoyaltyTierKey } from '~/types/crm-engagement'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Loyalty Program — CRM' })

const { canView, can } = usePermissions()
const { currentUser } = useCurrentUser()
const { showToast } = useToast()

const hasAccess = computed(() => canView('crm'))
const canManage = computed(() => can('crm.manage-follow-up'))

const refreshKey = ref(0)
const accounts = computed(() => {
  void refreshKey.value
  return getLoyaltyLeaderboard()
})

const TIER_TONE: Record<LoyaltyTierKey, BadgeTone> = {
  bronze: 'neutral',
  silver: 'info',
  gold: 'warning',
  platinum: 'purple'
}

const totals = computed(() => ({
  members: accounts.value.length,
  points: accounts.value.reduce((sum, account) => sum + account.totalPoints, 0),
  spend: accounts.value.reduce((sum, account) => sum + account.totalSpendIdr, 0)
}))

const tierDistribution = computed(() => LOYALTY_TIERS.map(tier => ({
  tier,
  count: accounts.value.filter(account => account.tier.key === tier.key).length
})))

/* Dialog penyesuaian poin */
const adjustTargetId = ref<string | undefined>()
const adjustPoints = ref<number | null>(null)
const adjustReason = ref('')

const adjustTarget = computed(() => accounts.value.find(account => account.partyId === adjustTargetId.value))
const adjustHistory = computed(() => (adjustTargetId.value ? getLoyaltyAdjustments(adjustTargetId.value) : []))

function openAdjust (partyId: string) {
  adjustTargetId.value = partyId
  adjustPoints.value = null
  adjustReason.value = ''
}

function submitAdjust () {
  if (!adjustTargetId.value || !adjustPoints.value || !adjustReason.value.trim()) { return }
  const result = addLoyaltyAdjustment(adjustTargetId.value, adjustPoints.value, adjustReason.value, currentUser.value.id)
  refreshKey.value += 1
  if (result) {
    showToast('Poin disesuaikan', `${result.points > 0 ? '+' : ''}${result.points} poin dicatat.`, 'success')
    adjustTargetId.value = undefined
  } else {
    showToast('Gagal', 'Poin harus bukan nol dan alasan wajib diisi.', 'error')
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Loyalty Program"
      description="Tier dan poin diturunkan dari invoice yang benar-benar sudah lunas — bukan angka yang dicatat terpisah."
      :breadcrumb="[{ label: 'CRM' }, { label: 'Loyalty Program' }]"
    />

    <RoleAccessState v-if="!hasAccess" module-label="modul CRM" />

    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatsCard title="Member Aktif" :value="String(totals.members)" :icon="Award" icon-color="primary" />
        <StatsCard title="Total Poin Beredar" :value="formatNumber(totals.points)" :icon="Coins" icon-color="warning" />
        <StatsCard title="Total Belanja Terhitung" :value="formatCurrencyIdr(totals.spend)" :icon="TrendingUp" icon-color="success" />
      </div>

      <SectionCard title="Tier & Benefit">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div
            v-for="entry in tierDistribution"
            :key="entry.tier.key"
            class="rounded-lg border border-border p-4"
          >
            <div class="flex items-center justify-between gap-2">
              <StatusBadge :label="entry.tier.label" :tone="TIER_TONE[entry.tier.key]" />
              <span class="text-sm font-semibold text-foreground">{{ entry.count }} member</span>
            </div>
            <p class="text-xs text-muted-foreground mt-2">
              Mulai {{ formatCurrencyIdr(entry.tier.minSpendIdr) }} · {{ entry.tier.pointsPerMillion }} poin / juta
            </p>
            <ul class="mt-2 space-y-0.5">
              <li
                v-for="benefit in entry.tier.benefits"
                :key="benefit"
                class="text-xs text-muted-foreground pl-3 relative before:content-['·'] before:absolute before:left-0"
              >
                {{ benefit }}
              </li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Peringkat Customer">
        <Table v-if="accounts.length">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead class="text-right">
                Total Belanja
              </TableHead>
              <TableHead class="text-right">
                Poin
              </TableHead>
              <TableHead>Menuju Tier Berikutnya</TableHead>
              <TableHead>Aktivitas Terakhir</TableHead>
              <TableHead v-if="canManage" class="text-right">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="account in accounts" :key="account.partyId">
              <TableCell>
                <NuxtLink :to="`/crm/parties/${account.partyId}`" class="text-sm font-medium text-foreground hover:text-primary">
                  {{ account.partyName }}
                </NuxtLink>
                <p class="text-xs text-muted-foreground">
                  {{ account.projectCount }} project
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge :label="account.tier.label" :tone="TIER_TONE[account.tier.key]" />
              </TableCell>
              <TableCell class="text-right text-sm text-foreground">
                {{ formatCurrencyIdr(account.totalSpendIdr) }}
              </TableCell>
              <TableCell class="text-right">
                <p class="text-sm font-semibold text-foreground">
                  {{ formatNumber(account.totalPoints) }}
                </p>
                <p v-if="account.adjustmentPoints" class="text-xs text-muted-foreground">
                  termasuk {{ account.adjustmentPoints > 0 ? '+' : '' }}{{ account.adjustmentPoints }} manual
                </p>
              </TableCell>
              <TableCell>
                <template v-if="account.nextTier">
                  <p class="text-xs text-muted-foreground">
                    {{ formatCurrencyIdr(account.spendToNextTierIdr) }} lagi ke {{ account.nextTier.label }}
                  </p>
                  <div class="mt-1 h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full bg-primary"
                      :style="{ width: `${Math.min(100, (account.totalSpendIdr / account.nextTier.minSpendIdr) * 100)}%` }"
                    />
                  </div>
                </template>
                <span v-else class="text-xs text-muted-foreground">Tier tertinggi</span>
              </TableCell>
              <TableCell>
                <span
                  :class="cn(
                    'text-sm',
                    (account.daysSinceLastProject ?? 0) > 90 ? 'text-warning font-medium' : 'text-muted-foreground'
                  )"
                >
                  {{ account.lastProjectAt ? `${account.daysSinceLastProject} hari lalu` : '—' }}
                </span>
              </TableCell>
              <TableCell v-if="canManage" class="text-right">
                <Button variant="outline" size="sm" @click="openAdjust(account.partyId)">
                  <Plus class="h-3.5 w-3.5 mr-1" />
                  Sesuaikan Poin
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <EmptyState v-else :icon="Award" title="Belum ada member loyalty" description="Customer masuk program setelah invoice pertamanya lunas." />
      </SectionCard>

      <Dialog :open="Boolean(adjustTargetId)" @update:open="value => { if (!value) adjustTargetId = undefined }">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Sesuaikan Poin — {{ adjustTarget?.partyName }}</DialogTitle>
            <DialogDescription>
              Gunakan nilai positif untuk bonus dan negatif untuk penukaran. Alasan wajib diisi agar jejaknya jelas.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>Jumlah Poin</Label>
              <Input v-model.number="adjustPoints" type="number" placeholder="mis. 250 atau -100" />
            </div>
            <div class="space-y-1.5">
              <Label>Alasan</Label>
              <textarea
                v-model="adjustReason"
                rows="2"
                placeholder="mis. Bonus referral klien baru"
                class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div v-if="adjustHistory.length">
              <p class="text-xs font-medium text-muted-foreground mb-1.5">
                Riwayat Penyesuaian
              </p>
              <ul class="space-y-1">
                <li v-for="item in adjustHistory" :key="item.id" class="text-xs text-muted-foreground">
                  <span :class="item.points > 0 ? 'text-success font-medium' : 'text-destructive font-medium'">
                    {{ item.points > 0 ? '+' : '' }}{{ item.points }}
                  </span>
                  · {{ item.reason }} ({{ formatDate(item.createdAt) }}, {{ getUserById(item.createdBy)?.name ?? item.createdBy }})
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" @click="adjustTargetId = undefined">
              Batal
            </Button>
            <Button :disabled="!adjustPoints || !adjustReason.trim()" @click="submitAdjust">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
