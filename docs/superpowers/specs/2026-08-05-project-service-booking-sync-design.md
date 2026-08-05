# Auto-Link & Status-Sync Project Services with Domain Bookings

Date: 2026-08-05
Status: Approved (pending spec review)

## Context

The Project Workspace page (`app/pages/projects/[id]/index.vue`, "Itinerary & Services" tab) shows one summary card per service type (Flight, Hotel, Transportation, MICE), each backed by `PROJECT_SERVICES` (`ProjectService` records: label, vendor, booking reference, status). Below a "+ Buat X Booking" button that navigates to the relevant module (`/ticketing`, `/accommodation`, `/transportation`, `/mice`) to create the actual detailed booking record (`FlightBooking`/`HotelBooking`/`TransportBooking`/`MiceEvent`).

These two data models are only weakly linked: each booking type has an optional `serviceId` field that CAN point back at a `ProjectService`, and reverse-lookup helpers (`getFlightBookingsByService` etc.) already exist — but none of the four `create*Booking`/`createMiceEvent` mutators ever populate or auto-generate that link, and none of the four `update*Status` mutators ever propagate a booking's status back to its linked `ProjectService.status`. In practice, every booking created via the "+ Buat X Booking" button today ends up permanently unlinked, so it never appears in the summary card, and the summary card's status can never reflect reality.

This isn't cosmetic: `getServiceReadinessMatrix`/`getDepartureReadiness` (used by the page's "Departure Readiness Gate") derive entirely from `ProjectService.status`, so the drift also silently breaks readiness reporting for any project whose bookings were created after the initial seed.

Only the seed data happens to look "linked" today, and that's from hand-authored consistency at fixture-writing time (e.g. `FLT-1011.serviceId = 'SVC-1011'`, matching PNR strings) — not a live invariant.

## Goals

- Creating a Flight/Hotel/Transportation/MICE booking automatically creates (or reuses) a linked `ProjectService` row, so it immediately shows up in the relevant summary card.
- Changing a booking's status automatically updates its linked `ProjectService.status` via a fixed mapping, keeping the summary card, readiness percentages, and Departure Readiness Gate accurate without manual double-entry.
- The summary card's manual "Update Status" dropdown becomes read-only (replaced by a badge + link to the booking) for any row that's linked to a real booking — manual override stays available only for rows with no linked booking (e.g. `additional` service type).

## Non-Goals

- No backfill/migration of existing seed data — seed `ProjectService`/booking pairs already agree by construction; this spec only wires up the runtime path going forward.
- No change to the existing "Booking Timeline" card (`getBookingTimeline`), which already correctly reads live booking data — it's unaffected by this work.
- No change to booking-status transition rules themselves (`FLIGHT_BOOKING_TRANSITIONS` etc.) — only an additional side-effect added to the existing mutators.

## Design

### 1. Shared helper — `app/data/index.ts`

```ts
function ensureProjectServiceForBooking (params: {
  projectId: string
  existingServiceId?: string
  type: ServiceTypeKey
  label: string
  status: ServiceStatus
}): string {
  if (params.existingServiceId) {
    const existing = PROJECT_SERVICES.find(s => s.id === params.existingServiceId)
    if (existing) {
      existing.status = params.status
      return existing.id
    }
  }
  const service: ProjectService = {
    id: nextSequentialId('SVC-', PROJECT_SERVICES),
    projectId: params.projectId,
    type: params.type,
    label: params.label,
    status: params.status
  }
  PROJECT_SERVICES.push(service)
  return service.id
}
```
Called from all four `create*` mutators, right before constructing the booking record, so the resulting `serviceId` can be written onto the new booking. Label derived from the project's destination to match existing seed style (e.g. `"Flight Abu Dhabi"`), falling back to a plain type label (`"Flight Booking"`) if the project/destination can't be resolved.

### 2. Status mapping — one small function per domain, `app/data/index.ts`

```ts
function mapFlightStatusToServiceStatus (status: FlightBookingStatus): ServiceStatus {
  if (status === 'confirmed' || status === 'issued') { return 'confirmed' }
  if (status === 'reissued') { return 'changed' }
  if (status === 'cancelled' || status === 'refunded') { return 'cancelled' }
  return 'pending-confirmation' // requested, hold
}

function mapHotelStatusToServiceStatus (status: HotelBookingStatus): ServiceStatus {
  if (status === 'confirmed') { return 'confirmed' }
  if (status === 'completed') { return 'completed' }
  if (status === 'amended') { return 'changed' }
  if (status === 'cancelled' || status === 'no-show') { return 'cancelled' }
  if (status === 'quoted') { return 'quoted' }
  return 'pending-confirmation' // requested
}

function mapTransportStatusToServiceStatus (status: TransportBookingStatus): ServiceStatus {
  if (status === 'confirmed') { return 'confirmed' }
  if (status === 'completed') { return 'completed' }
  if (status === 'cancelled' || status === 'no-show') { return 'cancelled' }
  if (status === 'quoted') { return 'quoted' }
  return 'pending-confirmation' // requested, assigned
}

function mapMiceStatusToServiceStatus (status: MiceEventStatus): ServiceStatus {
  if (status === 'confirmed' || status === 'in-progress') { return 'confirmed' }
  if (status === 'completed') { return 'completed' }
  if (status === 'cancelled') { return 'cancelled' }
  return 'pending-confirmation' // planning
}
```
Each `update*Status` mutator calls its mapper and, if `booking.serviceId` is set and resolves to a real `ProjectService`, sets `service.status` to the mapped value — right alongside the existing `syncBookingPaymentGateOnStatusChange` call already present in all four mutators.

### 3. UI — `app/pages/projects/[id]/index.vue` service table

The "Update Status" cell (currently an unconditional `<select>`, lines ~1653-1663) becomes conditional per row:
- If this `ProjectService` has at least one linked booking (checked via the existing `getFlightBookingsByService`/`getHotelBookingsByService`/`getTransportBookingsByService`/`getMiceEventsByService` reverse-lookup helpers, picked by `type.value`), render a read-only `StatusBadge` (same label/tone as today) plus a small `NuxtLink` to that booking's detail page (`/ticketing/[id]`, `/accommodation/[id]`, etc.) instead of the `<select>`.
- Otherwise (no linked booking — e.g. `additional` service type, or any legacy orphaned row), keep today's editable `<select>` + `handleServiceStatusChange` exactly as-is.

## Error Handling / Edge Cases

- A booking created with an explicit `serviceId` that doesn't actually exist in `PROJECT_SERVICES` falls through to the "create new" branch (same as no `serviceId` at all) rather than silently failing.
- If a `ProjectService` row is linked to a booking that's later deleted (not currently possible — no delete mutator exists for any booking type), the row simply stays at its last-synced status; not a new failure mode introduced here.
- Manual status edits remain possible for the small set of rows with no domain booking, preserving today's behavior for `additional` services.

## Testing / Verification

No automated test suite covers this area. Manual verification:
1. On a project's Flight card, click "+ Buat Flight Booking", fill the create form, submit — confirm a new row immediately appears in the Flight summary card (not just the Booking Timeline card below).
2. Advance that booking's status on its `/ticketing/[id]` detail page (e.g. `requested → hold → confirmed`) — confirm the Flight summary card's badge updates to match on next visit to the Project Workspace, and the "Update Status" dropdown for that row is gone (replaced by a badge + link).
3. Confirm the "X dari Y layanan siap (Confirmed/Completed)" count and Departure Readiness Gate reflect the new booking's status correctly.
4. Repeat steps 1-3 for Hotel, Transportation, and MICE.
5. Confirm a service row with no linked booking (e.g. an `additional` type row) still shows the original editable dropdown, unaffected.
