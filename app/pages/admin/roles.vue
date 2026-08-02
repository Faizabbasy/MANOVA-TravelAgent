<script setup lang="ts">
import { ROLES, ROLE_MODULE_ACCESS } from '~/constants/roles'
import type { ModuleKey, PermissionLevel } from '~/types/user'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })
useHead({ title: 'Roles and Permissions — Administration' })

const { canView } = usePermissions()

const modules: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'crm', label: 'CRM', description: 'Party, Opportunity, Quotation' },
  { key: 'project', label: 'Project', description: 'Project, Itinerary, Traveler' },
  { key: 'vendor', label: 'Vendor', description: 'Direktori & quotation vendor' },
  { key: 'finance', label: 'Finance', description: 'Invoice, Payment, Budget' },
  { key: 'reports', label: 'Reports', description: 'Laporan agregasi' },
  { key: 'administration', label: 'Admin', description: 'User, Role, Master Data' },
  { key: 'supplier-portal', label: 'Supplier Portal', description: 'Portal vendor eksternal (ter-isolasi)' },
  { key: 'client-portal', label: 'Client Portal', description: 'Portal client eksternal (ter-isolasi)' },
  { key: 'product-planning', label: 'Product Planning', description: 'Product Template, Cost Sheet (Section 10)' },
  { key: 'ticketing', label: 'Ticketing', description: 'Flight Booking lifecycle (Section 13)' },
  { key: 'accommodation', label: 'Accommodation', description: 'Hotel Booking lifecycle (Section 14)' },
  { key: 'transportation', label: 'Transportation', description: 'Transport Booking lifecycle (Section 15)' },
  { key: 'mice', label: 'MICE', description: 'MICE Event lifecycle (Section 16)' },
  { key: 'procurement', label: 'Procurement', description: 'RFQ/Service Order/Supplier Invoice lifecycle (Section 17)' },
  { key: 'bookings', label: 'Bookings', description: 'Booking & Service Order Center — timeline konsolidasi (Section 18)' },
  { key: 'changes', label: 'Changes & Incidents', description: 'Change Request/Cancellation/Refund/Incident (Section 19)' },
  { key: 'documents', label: 'Documents & Communication', description: 'Document center, Messages, Notification center (Section 21)' }
]

const PERMISSION_META: Record<PermissionLevel, { tone: string; description: string }> = {
  NONE: { tone: 'neutral', description: 'Tidak ada akses' },
  VIEW: { tone: 'info', description: 'Hanya baca' },
  MANAGE: { tone: 'primary', description: 'Baca + tulis + hapus' },
  APPROVE: { tone: 'warning', description: 'Manage + aksi approval' },
  ADMIN: { tone: 'destructive', description: 'Akses penuh termasuk admin' }
}

function permTone (level: PermissionLevel) {
  return PERMISSION_META[level].tone
}

// Catatan per-role yang lebih detail (sesuai docs/route-and-role-matrix.md bagian 5)
const ROLE_NOTES: Partial<Record<string, string>> = {
  'super-admin': 'Akses penuh ke seluruh modul tanpa pengecualian. Bukan commercial approver normal (approval harian tetap milik Management).',
  management: 'Approve/reject Commercial Approval Quotation, dan perubahan besar/cancel project. Tidak bisa manage user.',
  'account-executive': 'Kelola Opportunity/Requirement/Quotation sampai Won. Submit Quotation untuk Commercial Approval, Mark as Won setelah disetujui Management. Lihat Cost Sheet Product Planner sebagai referensi (Section 10).',
  sales: 'Kelola Lead (screening, qualification, assign ke Account Executive). Hanya lihat Opportunity hasil handover secara terbatas.',
  'product-planner': 'Manage penuh Product Template catalog dan Cost Sheet (Section 10). Lihat Opportunity/Project/Vendor sebagai referensi costing.',
  'project-manager': 'Manage seluruh tab project, termasuk modul Changes & Incidents penuh (Change Request/Cancellation/Refund/Incident, Section 19). Hanya lihat budget vs actual project miliknya.',
  operations: 'Manage tab Itinerary & Services (koordinasi umum), modul Booking & Service Order Center penuh (timeline konsolidasi, payment gate, exception queue, Section 18), dan modul Changes & Incidents penuh (Section 19). Tidak ada akses CRM/Finance.',
  ticketing: 'Manage penuh modul Ticketing (Flight Booking lifecycle, Section 13) dan sub-section Flight di Itinerary & Services. Tidak ada akses CRM/Finance.',
  accommodation: 'Manage penuh modul Accommodation (Hotel Booking lifecycle, Section 14) dan sub-section Hotel di Itinerary & Services. Tidak ada akses CRM/Finance.',
  transportation: 'Manage penuh modul Transportation (Transport Booking lifecycle, Section 15) dan sub-section Transportation di Itinerary & Services. Tidak ada akses CRM/Finance.',
  mice: 'Manage penuh modul MICE (MICE Event lifecycle, Section 16) dan sub-section MICE di Itinerary & Services. Tidak ada akses CRM/Finance.',
  procurement: 'Manage direktori Vendor (satu-satunya role non-Super-Admin yang dapat menambah vendor) dan modul Procurement penuh (RFQ, comparison, clarification, selection, Service Order, amendment, Supplier Invoice review, Performance Review, Section 17). Tidak ada akses CRM/Finance.',
  finance: 'Manage Invoice & Payment. Lihat Finance tab project. Tidak ada akses CRM write.',
  viewer: 'Akses baca ke seluruh modul. Tidak ada aksi tulis. Hanya lihat Audit Trail di Administration.',
  client: 'External — hanya akses Client Portal, ter-isolasi ke company sendiri. Tidak melihat internal cost/margin atau company lain.',
  supplier: 'External — hanya akses Supplier Portal, ter-isolasi ke vendor company sendiri. Tidak melihat vendor lain.'
}

// Legend
const levelOrder: PermissionLevel[] = ['NONE', 'VIEW', 'MANAGE', 'APPROVE', 'ADMIN']
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Roles and Permissions"
      description="Role & Access Matrix — referensi docs/route-and-role-matrix.md bagian 5."
      :breadcrumb="[{ label: 'Administration', to: '/admin' }, { label: 'Roles and Permissions' }]"
    />

    <RoleAccessState v-if="!canView('administration')" module-label="modul Administration" />

    <template v-else>
      <!-- Legend -->
      <SectionCard title="Legend Level Akses">
        <div class="flex flex-wrap gap-3">
          <div
            v-for="level in levelOrder"
            :key="level"
            class="flex items-center gap-2"
          >
            <StatusBadge :label="level" :tone="permTone(level)" />
            <span class="text-xs text-muted-foreground">{{ PERMISSION_META[level].description }}</span>
          </div>
        </div>
      </SectionCard>

      <!-- Matrix table -->
      <SectionCard title="Matrix Role × Modul">
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="min-w-[160px] whitespace-nowrap">
                  Role
                </TableHead>
                <TableHead v-for="mod in modules" :key="mod.key" class="text-center whitespace-nowrap min-w-[100px]">
                  <span class="font-medium">{{ mod.label }}</span>
                  <span class="block text-xs font-normal text-muted-foreground">{{ mod.description }}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="role in ROLES" :key="role.value">
                <TableCell class="whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <StatusBadge :label="role.label" :tone="role.tone" />
                  </div>
                  <p class="text-xs text-muted-foreground mt-1 max-w-[200px] leading-tight">
                    {{ ROLE_NOTES[role.value] ?? '' }}
                  </p>
                </TableCell>
                <TableCell
                  v-for="mod in modules"
                  :key="mod.key"
                  class="text-center"
                >
                  <StatusBadge
                    :label="ROLE_MODULE_ACCESS[role.value][mod.key]"
                    :tone="permTone(ROLE_MODULE_ACCESS[role.value][mod.key])"
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <!-- Action flags section -->
      <SectionCard title="Action Flags Khusus" description="Aksi spesifik yang memerlukan level akses tertentu (docs/route-and-role-matrix.md bagian 5.1).">
        <div class="divide-y divide-border">
          <div class="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
            <span class="font-medium text-foreground">Lihat info finansial (budget/cost/margin)</span>
            <span class="text-muted-foreground sm:col-span-2">Super Admin, Management, Finance, Viewer (read-only), PM (terbatas project miliknya)</span>
          </div>
          <div class="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
            <span class="font-medium text-foreground">Manage users</span>
            <span class="text-muted-foreground sm:col-span-2">Super Admin saja (ADMIN di Administration)</span>
          </div>
          <div class="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
            <span class="font-medium text-foreground">Approve (Won, perubahan besar, cancel project)</span>
            <span class="text-muted-foreground sm:col-span-2">Super Admin, Management</span>
          </div>
          <div class="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
            <span class="font-medium text-foreground">Change status (project/service non-approval)</span>
            <span class="text-muted-foreground sm:col-span-2">Role MANAGE di modul terkait (mis. PM untuk Project, Ticketing untuk Flight)</span>
          </div>
          <div class="py-3 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 text-sm">
            <span class="font-medium text-foreground">Delete mock</span>
            <span class="text-muted-foreground sm:col-span-2">Setara MANAGE/ADMIN di modul terkait</span>
          </div>
        </div>
      </SectionCard>
    </template>
  </div>
</template>
