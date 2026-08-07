<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from 'lucide-vue-next'
import { PROJECTS, getBookingTimeline, setBookingPaymentGateStatus, appendBookingAttempt } from '~/data'
import { BOOKING_PAYMENT_GATE_STATUSES, BOOKING_ATTEMPT_OUTCOMES, findStatusOption } from '~/constants/status'
import { formatCurrencyIdr, formatDate } from '~/utils/format'
import type { BookingDomain, BookingAttemptOutcome, BookingTimelineEntry } from '~/types/booking-orchestration'

/**
 * Tab "Bookings" — Menu Operations > Booking & Schedule (Penyederhanaan 7-Role/Menu). Dulu `/bookings`
 * (halaman utama), kini tab dalam satu menu bersama Calendar/Exceptions — logika tidak diubah.
 *
 * Consolidation/orchestration LAYER di atas Flight/Hotel/Transport/MICE booking (Section 13-16) — SATU
 * sumber kebenaran seluruh service (acceptance literal), BUKAN entitas komersial baru. Lihat
 * `docs/frontend-known-issues.md` bagian 13 untuk disambiguasi eksplisit dari `ServiceOrder` Procurement.
 */

const { currentUser } = useCurrentUser()
const { canView, canManage, canViewFinancials } = usePermissions()
const { showToast } = useToast()
const canManageBookings = computed(() => canManage('bookings'))
/** Net cost internal hanya untuk role finansial penuh (D-030) — konsisten pola D-070/D-071/D-072/D-073 pada domain asal, Operations (pemilik modul `bookings`) TIDAK otomatis melihat net cost lintas domain yang bukan wewenangnya. */
const canViewBookingFinancials = computed(() => canViewFinancials.value)

const DOMAIN_LABEL: Record<BookingDomain, string> = { flight: 'Flight', hotel: 'Hotel', transport: 'Transport', mice: 'MICE' }
const DOMAIN_TONE: Record<BookingDomain, string> = { flight: 'info', hotel: 'purple', transport: 'warning', mice: 'primary' }

const searchQuery = ref('')
const domainFilter = ref<'all' | BookingDomain>('all')
const projectFilter = ref('all')
const categoryFilter = ref('all')
const exceptionOnly = ref(false)

const allEntries = computed(() => getBookingTimeline())
const categoryOptions = ['Diproses', 'Dikonfirmasi', 'Selesai', 'Dibatalkan']

const rows = computed(() => {
  let result = allEntries.value
  if (domainFilter.value !== 'all') { result = result.filter(entry => entry.bookingType === domainFilter.value) }
  if (projectFilter.value !== 'all') { result = result.filter(entry => entry.projectId === projectFilter.value) }
  if (categoryFilter.value !== 'all') { result = result.filter(entry => entry.clientVisibleStatus === categoryFilter.value) }
  if (exceptionOnly.value) { result = result.filter(entry => entry.exceptions.length > 0) }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(entry =>
      entry.label.toLowerCase().includes(q) ||
      (entry.reference ?? '').toLowerCase().includes(q) ||
      entry.projectName.toLowerCase().includes(q) ||
      entry.bookingId.toLowerCase().includes(q)
    )
  }
  return result
})

/* Mark Payment Cleared (Wajib "Confirmation and payment gates") */
function markPaymentCleared (entry: BookingTimelineEntry) {
  setBookingPaymentGateStatus(entry.orchestrationId, 'cleared', currentUser.value.id)
  showToast('Payment Gate Diperbarui', `${DOMAIN_LABEL[entry.bookingType]} Booking ${entry.bookingId} kini "Lunas".`, 'success')
}

/* Failure/retry/manual fallback simulation (Wajib) */
const isAttemptDialogOpen = ref(false)
const attemptTargetEntry = ref<BookingTimelineEntry | null>(null)
const attemptOutcome = ref<BookingAttemptOutcome>('success')
const attemptNote = ref('')

function openAttemptDialog (entry: BookingTimelineEntry) {
  attemptTargetEntry.value = entry
  attemptOutcome.value = 'success'
  attemptNote.value = ''
  isAttemptDialogOpen.value = true
}

function submitAttempt () {
  if (!attemptTargetEntry.value) { return }
  appendBookingAttempt(attemptTargetEntry.value.orchestrationId, attemptOutcome.value, attemptNote.value.trim() || undefined, currentUser.value.id)
  isAttemptDialogOpen.value = false
  showToast('Percobaan Booking Dicatat', `Outcome "${findStatusOption(BOOKING_ATTEMPT_OUTCOMES, attemptOutcome.value).label}" tersimpan pada ${attemptTargetEntry.value.bookingId}.`, 'success')
  attemptTargetEntry.value = null
}
</script>

<template>
  <div class="space-y-6">
    <RoleAccessState v-if="!canView('bookings')" module-label="modul Booking & Schedule" />

    <template v-else>
      <div class="flex flex-col lg:flex-row items-start lg:items-center gap-3">
        <div class="relative flex-1 max-w-sm w-full">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Cari booking, referensi, atau project..." class="pl-9" />
        </div>
        <select v-model="domainFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Domain
          </option>
          <option value="flight">
            Flight
          </option>
          <option value="hotel">
            Hotel
          </option>
          <option value="transport">
            Transport
          </option>
          <option value="mice">
            MICE
          </option>
        </select>
        <select v-model="projectFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Project
          </option>
          <option v-for="project in PROJECTS" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
        <select v-model="categoryFilter" class="appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <option value="all">
            Semua Kategori Status
          </option>
          <option v-for="option in categoryOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
        <label class="flex items-center gap-2 text-sm text-foreground cursor-pointer whitespace-nowrap">
          <Checkbox v-model="exceptionOnly" />
          Hanya Exception
        </label>
      </div>

      <SectionCard title="Booking Timeline" :description="`${rows.length} dari ${allEntries.length} booking ditampilkan`">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Traveler / Deadline</TableHead>
                <TableHead>Status (Internal / Supplier / Client)</TableHead>
                <TableHead>Payment Gate</TableHead>
                <TableHead v-if="canViewBookingFinancials">
                  Net Cost / Sell Price
                </TableHead>
                <TableHead>Exceptions</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="entry in rows" :key="`${entry.bookingType}-${entry.bookingId}`">
                <TableCell class="min-w-[180px]">
                  <div class="flex items-center gap-1.5 mb-1">
                    <StatusBadge :label="DOMAIN_LABEL[entry.bookingType]" :tone="DOMAIN_TONE[entry.bookingType]" />
                    <NuxtLink :to="entry.detailHref" class="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {{ entry.bookingId }}
                    </NuxtLink>
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {{ entry.label }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Ref: {{ entry.reference ?? 'Belum terbit' }}
                  </p>
                  <div v-if="entry.dependencies.length" class="mt-1 flex flex-wrap gap-1">
                    <StatusBadge
                      v-for="dep in entry.dependencies"
                      :key="`${dep.bookingType}-${dep.bookingId}`"
                      :label="`${dep.isSatisfied ? '✓' : '⏳'} Depends: ${dep.label}`"
                      :tone="dep.isSatisfied ? 'success' : 'warning'"
                    />
                  </div>
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ entry.projectName }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  <p>{{ entry.travelerCount }} pax</p>
                  <p v-if="entry.deadlineDate">
                    Deadline: {{ formatDate(entry.deadlineDate) }}
                  </p>
                  <p v-else-if="entry.startDate">
                    Mulai: {{ formatDate(entry.startDate) }}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge :label="entry.internalStatus" :tone="entry.internalStatusTone" />
                  <p class="text-xs text-muted-foreground mt-1">
                    Supplier: {{ entry.supplierVisibleStatus }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Client: {{ entry.clientVisibleStatus }}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge :label="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).label" :tone="findStatusOption(BOOKING_PAYMENT_GATE_STATUSES, entry.paymentGateStatus).tone" />
                  <div v-if="canManageBookings && entry.paymentGateStatus === 'pending'" class="mt-1">
                    <Button size="sm" variant="outline" @click="markPaymentCleared(entry)">
                      Mark Payment Cleared
                    </Button>
                  </div>
                </TableCell>
                <TableCell v-if="canViewBookingFinancials" class="text-muted-foreground">
                  <p>Net: {{ entry.netCostIdr !== undefined ? formatCurrencyIdr(entry.netCostIdr) : '—' }}</p>
                  <p>Sell: {{ entry.sellPriceIdr !== undefined ? formatCurrencyIdr(entry.sellPriceIdr) : '—' }}</p>
                </TableCell>
                <TableCell class="max-w-[260px]">
                  <ul v-if="entry.exceptions.length" class="space-y-1">
                    <li v-for="(exception, index) in entry.exceptions" :key="index" class="text-xs text-destructive leading-snug">
                      {{ exception }}
                    </li>
                  </ul>
                  <span v-else class="text-xs text-muted-foreground">Tidak ada exception</span>
                </TableCell>
                <TableCell class="min-w-[160px]">
                  <div class="flex flex-col gap-1.5">
                    <NuxtLink v-if="entry.voucherHref" :to="entry.voucherHref" target="_blank">
                      <Button size="sm" variant="ghost" class="w-full justify-start">
                        Voucher / Preview
                      </Button>
                    </NuxtLink>
                    <Button v-if="canManageBookings" size="sm" variant="ghost" class="w-full justify-start" @click="openAttemptDialog(entry)">
                      Catat Percobaan
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <TableEmpty v-if="rows.length === 0" :colspan="canViewBookingFinancials ? 8 : 7">
                {{ searchQuery || domainFilter !== 'all' || projectFilter !== 'all' || categoryFilter !== 'all' || exceptionOnly ? 'Tidak ada booking yang cocok dengan filter.' : 'Belum ada booking tercatat.' }}
              </TableEmpty>
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <!-- Failure/retry/manual fallback simulation dialog -->
      <Dialog v-model:open="isAttemptDialogOpen">
        <DialogContent class="max-w-md">
          <DialogHeader>
            <DialogTitle>Catat Percobaan Booking</DialogTitle>
            <DialogDescription>
              {{ attemptTargetEntry ? `${DOMAIN_LABEL[attemptTargetEntry.bookingType]} Booking ${attemptTargetEntry.bookingId}` : '' }} — simulasi log percobaan (mock, tidak ada integrasi nyata).
            </DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div class="space-y-1.5">
              <Label for="attempt-outcome">Outcome</Label>
              <select id="attempt-outcome" v-model="attemptOutcome" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option v-for="option in BOOKING_ATTEMPT_OUTCOMES" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div class="space-y-1.5">
              <Label for="attempt-note">Catatan (opsional)</Label>
              <Input id="attempt-note" v-model="attemptNote" placeholder="mis. Retry otomatis gagal, diproses manual oleh tim." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isAttemptDialogOpen = false">
              Batal
            </Button>
            <Button @click="submitAttempt">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
