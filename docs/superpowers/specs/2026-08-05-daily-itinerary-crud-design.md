# Daily Itinerary Create/Edit/Delete + Export Reuse

Date: 2026-08-05
Status: Approved (pending spec review)

## Context

While auditing the Lead → Project-completion demo flow, the user asked to be able to input/edit/export data across the whole pipeline so they can run and demo it end-to-end themselves. Investigation showed this is almost entirely already true: Lead, Opportunity, Quotation, Flight/Hotel/Transportation/MICE bookings (both from inside a Project Workspace and standalone from their own modules), Cost Sheets, Invoices, Travelers/Rooming List, and Project status transitions are all already fully create/edit-able.

The one genuine gap is **Daily Itinerary** (`app/pages/projects/[id]/index.vue`, "Itinerary & Services" tab): `ITINERARY_ITEMS` (`app/data/projects.ts:252`) is static seed data. The only existing mutator, `updateItineraryItem` (`app/data/index.ts:158`), can only patch `visibleToClient`/`timezone` — by explicit prior design decision ("Day-by-day itinerary sudah COMPLETED... tanpa create/delete"). There is no create, no delete, and no way to edit the date/time/title/description/location of an item.

This spec covers building full CRUD for Daily Itinerary, scoped to inside the Project Workspace only (confirmed with the user — itinerary is inherently tied to one project, no standalone module page needed), plus surfacing the existing print/export pattern for it (no new export mechanism needed).

## Goals

- Operations users can add, edit, and delete Daily Itinerary items directly from the Project Workspace's "Itinerary & Services" tab.
- Reuse the existing print-preview export pattern (`window.print()`, no real file generation — consistent with the app's explicit D-006 protocol) instead of building a new export mechanism.
- Everything stays frontend/dummy-data only, consistent with the rest of the app.

## Non-Goals

- No standalone `/itinerary` module page — confirmed with the user, itinerary stays scoped inside Project Workspace only.
- No new export/print page — the existing `run-sheet-preview.vue` route already prints the daily itinerary as its first section; this work only makes it easier to reach from the Daily Itinerary card.
- No real file download (CSV/PDF) — confirmed with the user, stays consistent with the existing D-006 protocol decision against real document generators.
- No changes to any of the already-working modules (Flight/Hotel/Transportation/MICE/Cost Sheets/Invoices/Travelers/Project status) — audited and confirmed already fully functional.

## Design

### 1. Data layer — `app/data/index.ts`

- **`createItineraryItem(input: Omit<ItineraryItem, 'id'>): ItineraryItem`** — new mutator. Generates `id` via `nextSequentialId('ITIN-', ITINERARY_ITEMS)` (same helper every other entity uses), pushes into `ITINERARY_ITEMS`, returns the new item.
- **`updateItineraryItem`** — widen its patch type from `Partial<Pick<ItineraryItem, 'visibleToClient' | 'timezone'>>` to `Partial<Omit<ItineraryItem, 'id' | 'projectId'>>`, so it can patch every editable field (date, time, title, description, serviceType, groupId, timezone, visibleToClient, location). This is a strict widening — the existing call site (`toggleItineraryVisibility`, only ever passing `{ visibleToClient }`) keeps working unchanged. The function body (`Object.assign(item, patch)`) doesn't need to change at all. Update the stale doc-comment above it, which currently says CRUD is intentionally out of scope.
- **`removeItineraryItem(id: string): boolean`** — new mutator, splices the matching item out of `ITINERARY_ITEMS`, returns whether an item was found/removed.

### 2. UI — `app/pages/projects/[id]/index.vue`, "Daily Itinerary" `SectionCard`

- **`#actions` slot**: alongside the existing List/Timeline toggle, add:
  - A **"+ Tambah Item"** button, gated by the same `canManageOperations` permission already used for the visibility toggle.
  - A **"Print / Export Preview"** link to the existing `/projects/[id]/run-sheet-preview` route (same `Printer` icon + `Button` pattern already used elsewhere on this page for Manifest/Run Sheet export, e.g. lines 1283-1286) — reused as-is, no new route.
- **Per-item row**: add **"Edit"** and **"Hapus"** actions next to the existing "Jadikan Internal / Tampilkan ke Client" link, both gated by `canManageOperations`. Delete asks for confirmation before calling `removeItineraryItem`.
- **One shared Dialog** (used for both Create and Edit, mirroring the existing Flight Booking edit-dialog pattern in `app/pages/ticketing/[id]/index.vue`) with fields:
  - Tanggal (date input, required)
  - Jam (time input, optional)
  - Judul (text input, required)
  - Deskripsi (textarea, optional)
  - Lokasi (text input, optional)
  - Jenis Layanan (select, options from `SERVICE_TYPES`, optional)
  - Group Traveler (select, options from `groups` — already computed on this page via `getTravelerGroups(project.id)` at line 442 — optional)
  - Timezone (text input, optional, free text e.g. "Asia/Jakarta" — consistent with existing seed data, no real timezone library)
  - Tampilkan ke Client (checkbox, defaults checked/`true`)
- On submit: call `createItineraryItem` (create mode) or `updateItineraryItem` (edit mode), close the dialog, show a success toast (existing `useToast` pattern), matching required-field validation to prevent submitting without Tanggal/Judul.

### 3. Export

No new page. Add the "Print / Export Preview" link (see above) directly on the Daily Itinerary card, pointing at the already-existing `run-sheet-preview.vue`, whose "Jadwal Harian" section (lines 135-163 of that file) already renders the full itinerary grouped by date exactly like the Daily Itinerary card does, plus team/vendor/emergency contacts. This is the same print-then-Save-as-PDF mechanism used by every other export-like feature in the app (E-Ticket, Voucher, Quotation, Manifest, etc.).

## Error Handling / Edge Cases

- Create/Edit form requires Tanggal and Judul at minimum (matching the type's required fields, `date` and `title`) — submit is blocked with an inline/toast validation message if either is empty, not silently dropped (this repo just fixed an identical silent-drop bug in the Ticketing Edit form — this feature must not repeat that pattern).
- Delete requires confirmation before the mutator runs (no accidental data loss).
- `groupId` in the dropdown is restricted to the current project's own `TravelerGroup`s only (via the already-scoped `groups` computed) — never a cross-project id.

## Testing / Verification

No automated test suite covers this area. Manual verification:
1. Open a Project Workspace, "Itinerary & Services" tab. Click "+ Tambah Item", fill in a new itinerary entry, save — confirm it appears in the correct date group, in time order.
2. Edit an existing seeded item (e.g. change its time or title) — confirm the change reflects immediately in the list.
3. Delete an item — confirm it disappears and no other items are affected.
4. Click "Print / Export Preview" from the Daily Itinerary card — confirm it opens `run-sheet-preview` in a new tab and the newly added/edited item appears correctly in the printed "Jadwal Harian" section.
5. Confirm a user without `project-order.manage-operations` (e.g. a `sales` or `finance` role via Role Switcher) sees no Tambah/Edit/Hapus controls, consistent with the existing visibility-toggle gating.
