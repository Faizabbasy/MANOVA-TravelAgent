# Milestone Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PM/Super Admin define reusable "Milestone Template" records (name + list of milestone items, each with a day-offset from a reference date) in Setting > Master Data, then apply one to a Project Order's Timeline Tracking in one action — replacing that project's existing milestones with ones generated from the template.

**Architecture:** Reuse the existing generic Master Data CRUD infrastructure (`createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord` in `app/data/index.ts`, already fully generic over `Record<string, unknown>`) for the template records themselves — only the create/edit dialog gets a bespoke items-editor block (the generic flat-field renderer can't handle a nested array). A new pure function `applyMilestoneTemplate` in `app/data/project-order-workflow.ts` does the actual replace-and-generate logic, driven by `date-fns` `addDays` on a user-picked reference date. The UI trigger is a new "Terapkan Template" button + dialog in `ProjectOrderTimelineTracking.vue`, wired through `project-orders/[id]/index.vue` exactly like the existing "Tambah Milestone" button added in the previous session.

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup>` + TypeScript, Vitest for data-layer tests, `date-fns` for date math, existing shadcn-nuxt `Dialog`/`Input`/`Button`/`Label` components (all auto-imported, no explicit import needed in `.vue` files).

**Spec:** `docs/superpowers/specs/2026-09-08-milestone-template-design.md`

## Global Constraints

- Applying a template **replaces all** of a project's existing `ProjectMilestone` records (destructive, no undo) — confirmed design decision, not negotiable mid-implementation.
- Every milestone item's day offset is relative to one user-picked "Tanggal Acuan" (reference date) — `plannedDate = referenceDate + offsetDays`.
- No new CRUD mutator functions for the template records themselves — reuse `createMasterDataRecord`/`updateMasterDataRecord`/`deactivateMasterDataRecord`/`reactivateMasterDataRecord` as-is.
- Sub-item field name is `label` (not `name`), matching `MilestoneDeliverable.label` (`app/types/project-order.ts:59-63`) — this codebase's existing convention for "list of named sub-items".
- `npx vue-tsc --noEmit -p tsconfig.json` must be clean (no output) after every task in this plan — this is the standing verification bar used throughout this project's session history.
- Run `npm run test -- project-order-workflow` (Vitest) to run just that file's tests when noted below.

---

### Task 1: Type definitions + seed data + Master Data registry wiring

**Files:**
- Modify: `app/types/master-data.ts` (add `MilestoneTemplateItem`/`MilestoneTemplate` interfaces, extend `MasterDataCategoryKey`)
- Modify: `app/data/master-data.ts` (add `MILESTONE_TEMPLATES` seed array)
- Modify: `app/data/index.ts` (import + re-export `MILESTONE_TEMPLATES`, register it in `MASTER_DATA_REGISTRY`)

**Interfaces:**
- Produces: `MilestoneTemplateItem { id: ID; label: string; offsetDays: number }`, `MilestoneTemplate { id: ID; label: string; description?: string; items: MilestoneTemplateItem[]; isActive: boolean }`, `MasterDataCategoryKey` now includes `'milestone-template'`, `MILESTONE_TEMPLATES: MilestoneTemplate[]` importable from both `~/data/master-data` and `~/data`.

This task is pure data/types with no new runtime behavior of its own (Task 2 is what exercises it) — verification is the typecheck, not a Vitest test.

- [ ] **Step 1: Add the two new interfaces to `app/types/master-data.ts`**

Open `app/types/master-data.ts`. Insert this block right after the `AssignmentRule` interface (currently ends at line 123) and before the `OrganizationProfile` comment block (currently starts at line 125):

```ts
/**
 * Milestone Template — Setting > Master Data, kategori baru. Daftar milestone standar (nama + offset hari
 * dari satu tanggal acuan) yang bisa "diterapkan" sekaligus ke Timeline Tracking sebuah Project Order
 * (`applyMilestoneTemplate`, `app/data/project-order-workflow.ts`). Sub-item pakai `label` (bukan `name`),
 * konsisten dengan `MilestoneDeliverable.label` (`app/types/project-order.ts`) — pola sama untuk "daftar
 * sub-item bernama".
 */
export interface MilestoneTemplateItem {
  id: ID
  label: string
  /** 0 = tanggal acuan, 3 = acuan + 3 hari. Boleh negatif (sebelum tanggal acuan). */
  offsetDays: number
}

export interface MilestoneTemplate {
  id: ID
  label: string
  description?: string
  items: MilestoneTemplateItem[]
  isActive: boolean
}
```

- [ ] **Step 2: Extend `MasterDataCategoryKey`**

In the same file, find the `MasterDataCategoryKey` union (starts at line 148, ends with `| 'assignment-rule'` around line 163). Add a new member at the end:

```ts
export type MasterDataCategoryKey =
  | 'project-type'
  | 'service-type'
  | 'destination'
  | 'vendor-category'
  | 'airport'
  | 'airline'
  | 'hotel'
  | 'currency'
  | 'tax-rule'
  | 'payment-term'
  | 'cancellation-rule'
  | 'numbering-scheme'
  | 'document-template'
  | 'readiness-gate'
  | 'assignment-rule'
  | 'milestone-template'
```

- [ ] **Step 3: Add seed data to `app/data/master-data.ts`**

Open `app/data/master-data.ts`. Add `MilestoneTemplate` to the type import at the top of the file (currently `import type { MasterDataItem, Airport, Airline, Hotel, MasterCurrency, TaxRule, PaymentTerm, CancellationRule, NumberingScheme, DocumentTemplate, ReadinessGateConfig, AssignmentRule, OrganizationProfile } from '~/types/master-data'` — append `, MilestoneTemplate` before the closing `}`).

Then add this new exported array anywhere after the existing arrays (e.g. right after `MASTER_VENDOR_CATEGORIES` or at the end of the file, next to `ASSIGNMENT_RULES`):

```ts
/** Milestone Template — daftar milestone standar siap pakai untuk `applyMilestoneTemplate`. */
export const MILESTONE_TEMPLATES: MilestoneTemplate[] = reactive([
  {
    id: 'MTPL-001',
    label: 'Standard Corporate Trip',
    description: 'Alur milestone standar untuk corporate/business trip B2B.',
    isActive: true,
    items: [
      { id: 'MTPL-001-1', label: 'SPK / Handover Diterima', offsetDays: 0 },
      { id: 'MTPL-001-2', label: 'Finalisasi Itinerary', offsetDays: 3 },
      { id: 'MTPL-001-3', label: 'Invoice DP Terbit', offsetDays: 5 },
      { id: 'MTPL-001-4', label: 'Konfirmasi Vendor & Booking', offsetDays: 10 },
      { id: 'MTPL-001-5', label: 'Dokumen Traveler Lengkap', offsetDays: 20 },
      { id: 'MTPL-001-6', label: 'Keberangkatan', offsetDays: 30 },
      { id: 'MTPL-001-7', label: 'Trip Selesai', offsetDays: 34 },
      { id: 'MTPL-001-8', label: 'Closing Report', offsetDays: 40 }
    ]
  }
])
```

- [ ] **Step 4: Wire `MILESTONE_TEMPLATES` into `app/data/index.ts`**

Three small edits to `app/data/index.ts`:

1. In the `import { ... } from './master-data'` block (currently lines 36-40), add `MILESTONE_TEMPLATES` to the imported names:

```ts
import {
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES, ORGANIZATION_PROFILE,
  MILESTONE_TEMPLATES
} from './master-data'
```

2. In the big `export { ... }` re-export block (the line reading `MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,` — currently line 99), add `MILESTONE_TEMPLATES` right after `ORGANIZATION_PROFILE` on the following line:

```ts
  MASTER_PROJECT_TYPES, MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES, ORGANIZATION_PROFILE,
  MILESTONE_TEMPLATES,
```

3. In `MASTER_DATA_REGISTRY` (currently lines 5076-5092), add a new entry right after `'assignment-rule'`:

```ts
const MASTER_DATA_REGISTRY: Record<MasterDataCategoryKey, { list: MasterDataRecordShape[]; prefix: string; label: string }> = {
  'project-type': { list: MASTER_PROJECT_TYPES as unknown as MasterDataRecordShape[], prefix: 'PT-', label: 'Tipe Project' },
  'service-type': { list: MASTER_SERVICE_TYPES as unknown as MasterDataRecordShape[], prefix: 'ST-', label: 'Tipe Layanan' },
  destination: { list: MASTER_DESTINATIONS as unknown as MasterDataRecordShape[], prefix: 'DST-', label: 'Destinasi' },
  'vendor-category': { list: MASTER_VENDOR_CATEGORIES as unknown as MasterDataRecordShape[], prefix: 'VC-', label: 'Kategori Vendor' },
  airport: { list: AIRPORTS as unknown as MasterDataRecordShape[], prefix: 'APT-', label: 'Airport' },
  airline: { list: AIRLINES as unknown as MasterDataRecordShape[], prefix: 'ALN-', label: 'Airline' },
  hotel: { list: MASTER_HOTELS as unknown as MasterDataRecordShape[], prefix: 'MHTL-', label: 'Hotel' },
  currency: { list: MASTER_CURRENCIES as unknown as MasterDataRecordShape[], prefix: 'CUR-', label: 'Currency' },
  'tax-rule': { list: TAX_RULES as unknown as MasterDataRecordShape[], prefix: 'TAX-', label: 'Tax Rule' },
  'payment-term': { list: PAYMENT_TERMS as unknown as MasterDataRecordShape[], prefix: 'PTM-', label: 'Payment Term' },
  'cancellation-rule': { list: CANCELLATION_RULES as unknown as MasterDataRecordShape[], prefix: 'CXR-', label: 'Cancellation Rule' },
  'numbering-scheme': { list: NUMBERING_SCHEMES as unknown as MasterDataRecordShape[], prefix: 'NUM-', label: 'Numbering Scheme' },
  'document-template': { list: DOCUMENT_TEMPLATES as unknown as MasterDataRecordShape[], prefix: 'DTPL-', label: 'Document Template' },
  'readiness-gate': { list: READINESS_GATE_CONFIGS as unknown as MasterDataRecordShape[], prefix: 'RGC-', label: 'Readiness Gate' },
  'assignment-rule': { list: ASSIGNMENT_RULES as unknown as MasterDataRecordShape[], prefix: 'ASR-', label: 'Assignment Rule' },
  'milestone-template': { list: MILESTONE_TEMPLATES as unknown as MasterDataRecordShape[], prefix: 'MTPL-', label: 'Milestone Template' }
}
```

(Do not touch `getMasterDataUsageCount` — it already falls through to `return null` for any key without an explicit branch, which is the correct "honest, no fabricated cross-reference" behavior for this category too.)

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add app/types/master-data.ts app/data/master-data.ts app/data/index.ts
git commit -m "$(cat <<'EOF'
Add Milestone Template type, seed data, and Master Data registry entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `applyMilestoneTemplate` function + test

**Files:**
- Modify: `app/data/project-order-workflow.ts` (add `applyMilestoneTemplate`, import `MILESTONE_TEMPLATES` + `date-fns` helpers)
- Modify: `app/data/project-order-workflow.test.ts` (add test)

**Interfaces:**
- Consumes: `MILESTONE_TEMPLATES: MilestoneTemplate[]` (Task 1), `PROJECT_MILESTONES` (already imported in this file from `./project-orders`), `createProjectMilestone` (already defined in this file).
- Produces: `export function applyMilestoneTemplate (projectId: string, templateId: string, baseDate: string): ProjectMilestone[]` — used by Task 4's page handler.

- [ ] **Step 1: Write the failing test**

Open `app/data/project-order-workflow.test.ts`. Add `applyMilestoneTemplate` to the existing import from `./project-order-workflow` (currently the `import { PROJECT_ORDER_STEPS, ... } from './project-order-workflow'` block) and add `createMasterDataRecord` to the existing import from `./index`. Then add this new `describe` block at the end of the file:

```ts
describe('applyMilestoneTemplate', () => {
  it('mengganti seluruh milestone project dengan item dari template, plannedDate = baseDate + offset', () => {
    const created = createProject({
      partyId: 'PTY-001',
      name: 'Test Trip Apply Template',
      destination: 'Bandung, Indonesia',
      travelStartDate: '2027-05-10',
      travelEndDate: '2027-05-13',
      travelerCount: 4,
      serviceScope: ['flight'],
      quotationAmountIdr: 50_000_000
    })
    if (!created) { throw new Error('project harus berhasil dibuat') }

    const template = createMasterDataRecord('milestone-template', {
      label: 'Test Template',
      isActive: true,
      items: [
        { id: 'ITEM-1', label: 'Kickoff', offsetDays: 0 },
        { id: 'ITEM-2', label: 'Mid Check', offsetDays: 5 },
        { id: 'ITEM-3', label: 'Wrap Up', offsetDays: 12 }
      ]
    }, 'USR-001')

    const beforeCount = getProjectMilestones(created.id).length
    expect(beforeCount).toBeGreaterThan(0) // createProject auto-generates 8 default milestones

    const result = applyMilestoneTemplate(created.id, template.id, '2027-05-01')

    expect(result).toHaveLength(3)
    const milestones = getProjectMilestones(created.id)
    expect(milestones).toHaveLength(3)
    expect(milestones.map(m => m.name)).toEqual(['Kickoff', 'Mid Check', 'Wrap Up'])
    expect(milestones.map(m => m.plannedDate)).toEqual(['2027-05-01', '2027-05-06', '2027-05-13'])
    expect(milestones.every(m => m.status === 'not-started')).toBe(true)
  })

  it('tidak menyentuh milestone milik project lain', () => {
    const projectA = createProject({
      partyId: 'PTY-001',
      name: 'Test Trip A',
      destination: 'Solo, Indonesia',
      travelStartDate: '2027-06-01',
      travelEndDate: '2027-06-03',
      travelerCount: 2,
      serviceScope: ['flight'],
      quotationAmountIdr: 20_000_000
    })
    const projectB = createProject({
      partyId: 'PTY-001',
      name: 'Test Trip B',
      destination: 'Semarang, Indonesia',
      travelStartDate: '2027-06-05',
      travelEndDate: '2027-06-07',
      travelerCount: 2,
      serviceScope: ['flight'],
      quotationAmountIdr: 20_000_000
    })
    if (!projectA || !projectB) { throw new Error('kedua project harus berhasil dibuat') }

    const template = createMasterDataRecord('milestone-template', {
      label: 'Test Template B',
      isActive: true,
      items: [{ id: 'ITEM-B1', label: 'Only Step', offsetDays: 0 }]
    }, 'USR-001')

    const projectBMilestonesBefore = getProjectMilestones(projectB.id).length
    applyMilestoneTemplate(projectA.id, template.id, '2027-06-01')

    expect(getProjectMilestones(projectA.id)).toHaveLength(1)
    expect(getProjectMilestones(projectB.id)).toHaveLength(projectBMilestonesBefore)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- project-order-workflow`
Expected: FAIL — `applyMilestoneTemplate is not a function` (or similar), since it does not exist yet.

- [ ] **Step 3: Implement `applyMilestoneTemplate`**

Open `app/data/project-order-workflow.ts`. Add `addDays, parseISO, formatISO` to its `date-fns` import if not already present, and import `MILESTONE_TEMPLATES` from `./master-data`. Check the top of the file first — it currently imports `PROJECT_MILESTONES, PROJECT_NOTES` from `./project-orders`; add a new import line:

```ts
import { addDays, parseISO, formatISO } from 'date-fns'
import { MILESTONE_TEMPLATES } from './master-data'
```

Then add the function itself, right after `createProjectMilestone` (which currently ends around line 497 with its closing `}`):

```ts
/**
 * Terapkan Milestone Template ke sebuah project — MENGGANTI SELURUH milestone project ini (destruktif,
 * termasuk yang sudah selesai/ada catatan/budget/deliverables), bukan menambahkan. Keputusan desain
 * dikonfirmasi user (lihat docs/superpowers/specs/2026-09-08-milestone-template-design.md) — UI pemanggil
 * WAJIB menampilkan peringatan sebelum memanggil fungsi ini.
 */
export function applyMilestoneTemplate (projectId: string, templateId: string, baseDate: string): ProjectMilestone[] {
  const template = MILESTONE_TEMPLATES.find(item => item.id === templateId)
  if (!template) { return [] }

  const remaining = PROJECT_MILESTONES.filter(milestone => milestone.projectId !== projectId)
  PROJECT_MILESTONES.length = 0
  PROJECT_MILESTONES.push(...remaining)

  return template.items.map(item => createProjectMilestone({
    projectId,
    name: item.label,
    plannedDate: formatISO(addDays(parseISO(baseDate), item.offsetDays), { representation: 'date' })
  }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- project-order-workflow`
Expected: PASS (all tests in the file, including the two new ones).

- [ ] **Step 5: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add app/data/project-order-workflow.ts app/data/project-order-workflow.test.ts
git commit -m "$(cat <<'EOF'
Add applyMilestoneTemplate: replace project milestones from a template

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Master Data UI — Milestone Template category with items editor

**Files:**
- Modify: `app/pages/admin/master-data.vue`

**Interfaces:**
- Consumes: `MILESTONE_TEMPLATES` (Task 1, imported from `~/data`), `createMasterDataRecord`/`updateMasterDataRecord` (existing, already imported in this file) — called with a `payload.items` field this task adds.
- Produces: nothing consumed by later tasks (this is the leaf "management" UI) — Task 4 reads `MILESTONE_TEMPLATES` directly, not through this page.

This task has no automated test (this codebase has no Vue component test suite for pages) — verification is the typecheck plus a manual smoke-check description in the final step.

- [ ] **Step 1: Add icon imports**

In `app/pages/admin/master-data.vue`, line 3 currently reads:

```ts
import { Plus, Pencil, Ban, RotateCcw, Layers, MapPin, Building2, FolderKanban, Plane, BedDouble, Coins, Percent, CalendarClock, ShieldAlert, Hash, FileText, Gauge, Route } from 'lucide-vue-next'
```

Change it to add `LayoutTemplate, Trash2`:

```ts
import { Plus, Pencil, Ban, RotateCcw, Layers, MapPin, Building2, FolderKanban, Plane, BedDouble, Coins, Percent, CalendarClock, ShieldAlert, Hash, FileText, Gauge, Route, LayoutTemplate, Trash2 } from 'lucide-vue-next'
```

- [ ] **Step 2: Import `MILESTONE_TEMPLATES`**

The `import { ... } from '~/data'` block (lines 4-9) currently reads:

```ts
import {
  MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES,
  createMasterDataRecord, updateMasterDataRecord, deactivateMasterDataRecord, reactivateMasterDataRecord, getMasterDataUsageCount
} from '~/data'
```

Add `MILESTONE_TEMPLATES` to the first line of category arrays:

```ts
import {
  MASTER_SERVICE_TYPES, MASTER_DESTINATIONS, MASTER_VENDOR_CATEGORIES, MILESTONE_TEMPLATES,
  AIRPORTS, AIRLINES, MASTER_HOTELS, MASTER_CURRENCIES, TAX_RULES, PAYMENT_TERMS, CANCELLATION_RULES,
  NUMBERING_SCHEMES, DOCUMENT_TEMPLATES, READINESS_GATE_CONFIGS, ASSIGNMENT_RULES,
  createMasterDataRecord, updateMasterDataRecord, deactivateMasterDataRecord, reactivateMasterDataRecord, getMasterDataUsageCount
} from '~/data'
```

- [ ] **Step 3: Add the category to `GROUPS` and `CATEGORY_ICONS`**

In the `operational` group's `categories` array (ends with the `hotel` entry, currently line 64), add a new entry right after it:

```ts
      { key: 'hotel', label: 'Hotel', description: 'Referensi hotel. TIDAK ditautkan sebagai foreign key ke HotelBooking (LOCKED) — murni referensi admin.', list: MASTER_HOTELS, fields: [{ key: 'name', label: 'Nama Hotel', type: 'text' }, { key: 'city', label: 'Kota', type: 'text' }, { key: 'starRating', label: 'Star Rating', type: 'number' }] },
      { key: 'milestone-template', label: 'Milestone Template', description: 'Template milestone standar (nama + offset hari dari tanggal acuan) — bisa diterapkan sekaligus ke Timeline Tracking sebuah Project Order.', list: MILESTONE_TEMPLATES, fields: [{ key: 'label', label: 'Nama', type: 'text' }, { key: 'description', label: 'Deskripsi', type: 'text' }] }
```

(Note: `fields` intentionally excludes `items` — it is not a flat text/number field, and is handled separately in Steps 5-7 below.)

In `CATEGORY_ICONS` (currently lines 91-107, ends with `'assignment-rule': Route`), add:

```ts
const CATEGORY_ICONS: Record<MasterDataCategoryKey, any> = {
  'project-type': FolderKanban,
  'service-type': Layers,
  destination: MapPin,
  'vendor-category': Building2,
  airport: Plane,
  airline: Plane,
  hotel: BedDouble,
  currency: Coins,
  'tax-rule': Percent,
  'payment-term': CalendarClock,
  'cancellation-rule': ShieldAlert,
  'numbering-scheme': Hash,
  'document-template': FileText,
  'readiness-gate': Gauge,
  'assignment-rule': Route,
  'milestone-template': LayoutTemplate
}
```

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output. (This confirms the category wiring alone is type-sound before adding the more complex form logic below.)

- [ ] **Step 5: Add item-editor state and functions**

Find the `/* ---------- Create / Edit form (generik, field dari CategoryDef.fields) ---------- */` section (currently starts at line 134 with `const isFormOpen = ref(false)`). Add new state right after the existing `const formValues = reactive<Record<string, any>>({})` line:

```ts
/** Item milestone template — TERPISAH dari `formValues` generik karena bukan flat field (array of {id, label, offsetDays}). */
const formItems = ref<{ id: string; label: string; offsetDays: number }[]>([])
const newItemLabel = ref('')
const newItemOffset = ref<number | null>(0)
let itemSeq = 0

function addTemplateItem () {
  if (!newItemLabel.value.trim()) { return }
  itemSeq += 1
  formItems.value.push({ id: `TPLITEM-${Date.now()}-${itemSeq}`, label: newItemLabel.value.trim(), offsetDays: newItemOffset.value ?? 0 })
  newItemLabel.value = ''
  newItemOffset.value = 0
}

function removeTemplateItem (id: string) {
  formItems.value = formItems.value.filter(item => item.id !== id)
}
```

- [ ] **Step 6: Extend `openCreate`/`openEdit`/`submitForm` to carry `formItems`**

`openCreate` currently reads (around line 140):

```ts
function openCreate () {
  formMode.value = 'create'
  editingId.value = null
  for (const key in formValues) { delete formValues[key] }
  for (const field of activeCategory.value.fields) { formValues[field.key] = field.type === 'number' ? null : '' }
  isFormOpen.value = true
}
```

Add a reset of `formItems` before `isFormOpen.value = true`:

```ts
function openCreate () {
  formMode.value = 'create'
  editingId.value = null
  for (const key in formValues) { delete formValues[key] }
  for (const field of activeCategory.value.fields) { formValues[field.key] = field.type === 'number' ? null : '' }
  formItems.value = []
  isFormOpen.value = true
}
```

`openEdit` currently reads (around line 148):

```ts
function openEdit (item: Record<string, any>) {
  formMode.value = 'edit'
  editingId.value = item.id
  for (const key in formValues) { delete formValues[key] }
  for (const field of activeCategory.value.fields) { formValues[field.key] = item[field.key] ?? (field.type === 'number' ? null : '') }
  isFormOpen.value = true
}
```

Add population of `formItems` before `isFormOpen.value = true`:

```ts
function openEdit (item: Record<string, any>) {
  formMode.value = 'edit'
  editingId.value = item.id
  for (const key in formValues) { delete formValues[key] }
  for (const field of activeCategory.value.fields) { formValues[field.key] = item[field.key] ?? (field.type === 'number' ? null : '') }
  formItems.value = activeCategoryKey.value === 'milestone-template'
    ? ((item.items as { id: string; label: string; offsetDays: number }[] | undefined) ?? []).map(templateItem => ({ ...templateItem }))
    : []
  isFormOpen.value = true
}
```

`submitForm` currently builds `payload` like this (around line 188-212):

```ts
function submitForm () {
  if (!isFormValid.value) {
    showToast('Gagal Menyimpan', 'Seluruh field wajib diisi.', 'error')
    return
  }
  const payload: Record<string, any> = {}
  for (const field of activeCategory.value.fields) {
    payload[field.key] = field.type === 'number' ? formValues[field.key] : String(formValues[field.key]).trim()
  }

  if (formMode.value === 'create') {
```

Add the `items` field to `payload` right after the `for` loop that builds it:

```ts
  const payload: Record<string, any> = {}
  for (const field of activeCategory.value.fields) {
    payload[field.key] = field.type === 'number' ? formValues[field.key] : String(formValues[field.key]).trim()
  }
  if (activeCategoryKey.value === 'milestone-template') {
    payload.items = formItems.value
  }

  if (formMode.value === 'create') {
```

- [ ] **Step 7: Add the items-editor block to the dialog template**

In the `<!-- Create/Edit dialog (generik, field dari CategoryDef) -->` `Dialog` (currently starts at line 358), find the closing of the `v-for="field in activeCategory.fields"` div (the block ends right before the outer `</div>` that closes `<div class="space-y-4 py-2">`, currently around line 382-383):

```html
          <div class="space-y-4 py-2">
            <div v-for="field in activeCategory.fields" :key="field.key" class="space-y-1.5">
              <Label :for="`md-field-${field.key}`">{{ field.label }}</Label>
              <textarea
                v-if="field.type === 'textarea'"
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                rows="3"
                class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                :placeholder="field.placeholder"
              />
              <Input
                v-else
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                :type="field.type === 'number' ? 'number' : 'text'"
                :placeholder="field.placeholder"
              />
            </div>
          </div>
```

Add a new block right after the `v-for` div, still inside `<div class="space-y-4 py-2">`:

```html
          <div class="space-y-4 py-2">
            <div v-for="field in activeCategory.fields" :key="field.key" class="space-y-1.5">
              <Label :for="`md-field-${field.key}`">{{ field.label }}</Label>
              <textarea
                v-if="field.type === 'textarea'"
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                rows="3"
                class="w-full px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                :placeholder="field.placeholder"
              />
              <Input
                v-else
                :id="`md-field-${field.key}`"
                v-model="formValues[field.key]"
                :type="field.type === 'number' ? 'number' : 'text'"
                :placeholder="field.placeholder"
              />
            </div>

            <div v-if="activeCategoryKey === 'milestone-template'" class="space-y-2">
              <Label>Item Milestone</Label>
              <div v-if="formItems.length" class="space-y-1.5">
                <div v-for="item in formItems" :key="item.id" class="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                  <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{ item.label }}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">H{{ item.offsetDays >= 0 ? '+' : '' }}{{ item.offsetDays }}</span>
                  <button type="button" class="shrink-0 text-muted-foreground hover:text-destructive" title="Hapus" @click="removeTemplateItem(item.id)">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                Belum ada item milestone.
              </p>
              <div class="flex gap-2">
                <Input v-model="newItemLabel" type="text" placeholder="Nama milestone" class="flex-1" @keyup.enter="addTemplateItem" />
                <Input v-model.number="newItemOffset" type="number" placeholder="Offset hari" class="w-28" @keyup.enter="addTemplateItem" />
                <Button size="sm" variant="outline" class="shrink-0" @click="addTemplateItem">
                  Tambah
                </Button>
              </div>
            </div>
          </div>
```

- [ ] **Step 8: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 9: Manual smoke-check**

Start the dev server if not already running (`npm run dev`, port 8080), open `http://localhost:8080/admin/master-data`, click into "Milestone Template" under Operational Reference. Confirm: the seed "Standard Corporate Trip" row shows in the table; clicking "Tambah" opens the dialog with the Nama/Deskripsi fields AND the item-editor below them; adding a row with label "Test" and offset "5" shows it in the list with "H+5"; clicking the trash icon removes it; clicking Simpan creates a new template row in the table.

- [ ] **Step 10: Commit**

```bash
git add app/pages/admin/master-data.vue
git commit -m "$(cat <<'EOF'
Add Milestone Template category to Master Data with items editor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: "Terapkan Template" button in Timeline Tracking + page wiring

**Files:**
- Modify: `app/components/project-order/ProjectOrderTimelineTracking.vue`
- Modify: `app/pages/project-orders/[id]/index.vue`

**Interfaces:**
- Consumes: `MILESTONE_TEMPLATES` (Task 1), `applyMilestoneTemplate` (Task 2).
- Produces: new component emit `apply-template: [payload: { templateId: string; baseDate: string }]`.

No automated test (same reasoning as Task 3) — verified by typecheck plus a manual smoke-check.

- [ ] **Step 1: Import `MILESTONE_TEMPLATES` and add dialog state**

In `app/components/project-order/ProjectOrderTimelineTracking.vue`, line 6 currently reads:

```ts
import { USERS, getUserById } from '~/data'
```

Change to:

```ts
import { USERS, MILESTONE_TEMPLATES, getUserById } from '~/data'
```

Add `LayoutTemplate` and `AlertTriangle` to the icon import (line 3 currently ends with `..., Settings2, Plus } from 'lucide-vue-next'`):

```ts
import { Table as TableIcon, GanttChartSquare, Info, Check, X, StickyNote, ChevronDown, Wallet, ListChecks, Trash2, Settings2, Plus, LayoutTemplate, AlertTriangle } from 'lucide-vue-next'
```

Add the new emit to the `defineEmits` block (currently ends with `'add-milestone': [payload: { name: string; plannedDate: string; ownerId?: string; budgetIdr?: number }]` before its closing `}>()`):

```ts
const emit = defineEmits<{
  'update-planned': [payload: { milestoneId: string; plannedDate: string }]
  'mark-actual': [milestoneId: string]
  'update-note': [payload: { milestoneId: string; note: string }]
  'toggle-deliverable': [payload: { milestoneId: string; deliverableId: string }]
  'add-deliverable': [payload: { milestoneId: string; label: string }]
  'remove-deliverable': [payload: { milestoneId: string; deliverableId: string }]
  'update-budget': [payload: { milestoneId: string; budgetIdr?: number }]
  'add-milestone': [payload: { name: string; plannedDate: string; ownerId?: string; budgetIdr?: number }]
  'apply-template': [payload: { templateId: string; baseDate: string }]
}>()
```

Add new dialog state right after the existing "Tambah Milestone" dialog state (right after the `submitAddMilestone` function, which currently ends around line 57):

```ts
/** Dialog "Terapkan Template" — pilih Milestone Template aktif + tanggal acuan, mengganti seluruh milestone project ini. */
const isApplyTemplateOpen = ref(false)
const applyTemplateId = ref('')
const applyBaseDate = ref('')

const activeMilestoneTemplates = computed(() => MILESTONE_TEMPLATES.filter(template => template.isActive))
const selectedApplyTemplate = computed(() => MILESTONE_TEMPLATES.find(template => template.id === applyTemplateId.value))

function openApplyTemplateDialog () {
  applyTemplateId.value = ''
  applyBaseDate.value = ''
  isApplyTemplateOpen.value = true
}

function submitApplyTemplate () {
  if (!applyTemplateId.value || !applyBaseDate.value) { return }
  emit('apply-template', { templateId: applyTemplateId.value, baseDate: applyBaseDate.value })
  isApplyTemplateOpen.value = false
}
```

- [ ] **Step 2: Add the "Terapkan Template" button**

Find the `#actions` template slot (currently starts at line 152). It currently reads:

```html
    <template #actions>
      <div class="flex items-center gap-2">
        <Button v-if="canManage" size="sm" variant="outline" @click="openAddDialog">
          <Plus class="mr-1 h-3.5 w-3.5" />Tambah Milestone
        </Button>
        <div class="inline-flex rounded-lg border border-border p-0.5">
```

Add the new button right before the existing "Tambah Milestone" button:

```html
    <template #actions>
      <div class="flex items-center gap-2">
        <Button v-if="canManage" size="sm" variant="outline" @click="openApplyTemplateDialog">
          <LayoutTemplate class="mr-1 h-3.5 w-3.5" />Terapkan Template
        </Button>
        <Button v-if="canManage" size="sm" variant="outline" @click="openAddDialog">
          <Plus class="mr-1 h-3.5 w-3.5" />Tambah Milestone
        </Button>
        <div class="inline-flex rounded-lg border border-border p-0.5">
```

- [ ] **Step 3: Add the "Terapkan Template" dialog**

Find the existing "Tambah Milestone" `Dialog` (starts at `<Dialog v-model:open="isAddOpen">`, currently line 400) and its matching `</Dialog>` close tag right before `<Sheet v-model:open="isManageOpen">`. Add the new dialog right after the "Tambah Milestone" dialog's closing `</Dialog>` and before the `<Sheet>`:

```html
    <Dialog v-model:open="isApplyTemplateOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Terapkan Milestone Template</DialogTitle>
          <DialogDescription>Seluruh milestone project ini akan digantikan oleh isi template yang dipilih.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-1.5">
            <Label for="apply-template-select">Template</Label>
            <select id="apply-template-select" v-model="applyTemplateId" class="w-full appearance-none px-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
              <option value="">
                Pilih template
              </option>
              <option v-for="template in activeMilestoneTemplates" :key="template.id" :value="template.id">
                {{ template.label }} ({{ template.items.length }} milestone)
              </option>
            </select>
          </div>
          <div class="space-y-1.5">
            <Label for="apply-template-date">Tanggal Acuan</Label>
            <Input id="apply-template-date" v-model="applyBaseDate" type="date" />
          </div>
          <div v-if="selectedApplyTemplate" class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertTriangle class="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <p class="text-xs text-destructive">
              Seluruh milestone project ini akan DIHAPUS dan digantikan oleh {{ selectedApplyTemplate.items.length }} milestone dari template ini. Aksi ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isApplyTemplateOpen = false">
            Batal
          </Button>
          <Button :disabled="!applyTemplateId || !applyBaseDate" variant="destructive" @click="submitApplyTemplate">
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
```

- [ ] **Step 4: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 5: Wire the handler in `app/pages/project-orders/[id]/index.vue`**

Find `onAddMilestone` (added in the previous session, currently reads):

```ts
function onAddMilestone (payload: { name: string; plannedDate: string; ownerId?: string; budgetIdr?: number }) {
  if (!project.value) { return }
  createProjectMilestone({
    projectId: project.value.id,
    name: payload.name,
    plannedDate: payload.plannedDate,
    ownerId: payload.ownerId,
    budgetIdr: payload.budgetIdr
  })
  refreshStep()
  showToast('Milestone Ditambahkan', `"${payload.name}" berhasil ditambahkan ke Timeline Tracking.`, 'success')
}
```

Add a new handler right after it:

```ts
function onApplyMilestoneTemplate (payload: { templateId: string; baseDate: string }) {
  if (!project.value) { return }
  const created = applyMilestoneTemplate(project.value.id, payload.templateId, payload.baseDate)
  refreshStep()
  showToast('Template Diterapkan', `${created.length} milestone dibuat dari template.`, 'success')
}
```

Add `applyMilestoneTemplate` to the existing `import { ... } from '~/data/project-order-workflow'` block (currently ends with `..., createProjectMilestone } from '~/data/project-order-workflow'`):

```ts
import {
  getProjectOrderStepViews, advanceProjectOrder, getProjectMilestones,
  setMilestoneActualDate, updateMilestonePlannedDate, updateMilestoneNote, getProjectOrderStep,
  getProjectMilestoneSummary, getMilestoneProgressPercent, toggleMilestoneDeliverable,
  addMilestoneDeliverable, removeMilestoneDeliverable, updateMilestoneBudget, getProjectMilestoneBudgetSummary,
  createProjectMilestone, applyMilestoneTemplate
} from '~/data/project-order-workflow'
```

Find the `<ProjectOrderTimelineTracking ... @add-milestone="onAddMilestone" />` usage and add the new listener:

```html
          <ProjectOrderTimelineTracking
            :project-id="project.id"
            :milestones="milestones"
            :can-manage="canManageOperations"
            :planned-dates-locked="plannedDatesLocked"
            @mark-actual="onMarkMilestoneActual"
            @update-planned="onUpdateMilestonePlanned"
            @update-note="onUpdateMilestoneNote"
            @toggle-deliverable="onToggleMilestoneDeliverable"
            @add-deliverable="onAddMilestoneDeliverable"
            @remove-deliverable="onRemoveMilestoneDeliverable"
            @update-budget="onUpdateMilestoneBudget"
            @add-milestone="onAddMilestone"
            @apply-template="onApplyMilestoneTemplate"
          />
```

- [ ] **Step 6: Typecheck**

Run: `npx vue-tsc --noEmit -p tsconfig.json`
Expected: no output.

- [ ] **Step 7: Manual smoke-check**

With the dev server running, open a Project Order detail page (`/project-orders/<id>`), go to the Milestone tab. Confirm the "Terapkan Template" button appears next to "Tambah Milestone". Click it, pick "Standard Corporate Trip" from the dropdown, pick a reference date, confirm the destructive-warning text shows the right count (8), click "Terapkan", confirm the Timeline Tracking list is replaced by 8 new milestones with planned dates matching the reference date + offsets, and the "Total Milestone" stat card updates accordingly.

- [ ] **Step 8: Commit**

```bash
git add app/components/project-order/ProjectOrderTimelineTracking.vue "app/pages/project-orders/[id]/index.vue"
git commit -m "$(cat <<'EOF'
Add Terapkan Template button to Timeline Tracking

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
