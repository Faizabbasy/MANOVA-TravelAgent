# Auto-Provision Client Login Account on Opportunity Won + "Manova Client" Milestone Badge

Date: 2026-08-05
Status: Approved (pending spec review)

## Context

The Lead → Qualification → Opportunity → Won pipeline is already fully implemented as dummy/frontend-only data in `app/data/index.ts` (see `createLead`, `qualifyLeadAndCreateOpportunity`, `approveOpportunityWon`). When an Opportunity is marked **Won**, the linked `Party` already flips from `lifecycleStatus: 'prospect'` to `'client'` and a `Project` is created.

What's missing, and what this feature adds:

1. No login `User` account is ever automatically created for a Party that becomes a client. Client Portal (`/client/*`) access today only exists for 3 hand-seeded demo users (`USR-019`–`021`). There is no way to demo "sales closes a brand-new deal → that client can immediately access their own portal" without manually editing seed data.
2. There's no distinct milestone marking a client that has actually completed a trip/project, versus a client that has only just closed their first deal.

This is a pure frontend/dummy-data feature. No backend, no real authentication, no real email delivery — consistent with the rest of the codebase (`app/data/*.ts` reactive arrays, no API layer).

## Goals

- The moment an Opportunity is marked **Won**, automatically provision a `User` login account (`role: 'client'`) linked to the now-client `Party`, with zero manual steps.
- Make that account immediately visible/demoable: a toast at the moment of Won, an activity log entry, and a "Portal Access" card on the Party detail page.
- The new account must be usable immediately via the existing **Role Switcher** (Settings page / `useCurrentUser`) to view the Client Portal as that client.
- Add a derived "Manova Client" milestone badge, shown once a client's Party has at least one `Project` with `status === 'completed'`.

## Non-Goals

- No change to the trigger point for becoming a `client` — stays at Won, not at Qualification (explicitly decided).
- No change to `/login.vue` — it stays a non-functional dummy form. Demo access is exclusively via Role Switcher.
- No password/credential handling of any kind — `User` has no password field and none will be added.
- No new funnel stage on the Customer Journey hub (`/customer-journey/index.vue`) — explicitly decided out of scope.
- No backend/API integration, no real email sending.

## Design

### 1. Auto-create client `User` on Won

Location: `approveOpportunityWon()` in `app/data/index.ts`, in the existing `if (party) { ... }` block that currently only sets `party.lifecycleStatus = 'client'`.

Behavior, in order:
- **Duplicate guard first:** if a `User` already exists with `clientPartyId === party.id` (repeat-client scenario — the party dedup in `qualifyLeadAndCreateOpportunity` can reuse an existing Party), skip creation entirely and reuse the existing account. No duplicate `User` records.
- Otherwise, create a new `User`:
  - `id`: next sequential `USR-xxx` (same helper pattern as other entities, `nextSequentialId('USR-', USERS)`)
  - `name`: the opportunity's contact name (`opportunity.contactName`, falling back to the source lead's `name` via `opportunity.leadId`)
  - `email`: the source lead's `email` if present; otherwise an auto-generated placeholder built from slugified contact name + slugified party/company name with a clearly-fake domain, e.g. `hendra.wijaya@cipta-distribusi.demo`
  - `role: 'client'`
  - `clientPartyId: party.id`
  - `status: 'active'`
- Push into the existing reactive `USERS` array (`app/data/users.ts`) — since `useCurrentUser` reads `USERS` directly, the new account appears in the Role Switcher immediately, no extra wiring needed.

### 2. Visibility at the moment of Won

- **Toast**: fired from the Opportunity detail page (`app/pages/crm/opportunities/[id]/index.vue`) right after a successful `approveOpportunityWon()` call, using the existing `useToast` composable. Message communicates the account email and that it's accessible via Role Switcher.
- **Activity log**: one `ACTIVITIES` entry (same pattern as the existing "Project dibuat dari Opportunity..." entry already written in `approveOpportunityWon`), e.g. "Client login account created: `<email>`".
- **Portal Access card**: a small new card on the Party detail page (`app/pages/crm/parties/[id]/index.vue`), shown only when a `client`-role `User` with matching `clientPartyId` exists — displays name, email, status of the linked account.

### 3. "Manova Client" milestone badge

- **Derived, not stored** — a helper `isManovaClient(partyId: string): boolean` in `app/data/index.ts` that returns true if any `Project` with `partyId` matching has `status === 'completed'`. This follows the codebase's existing stated convention of preferring pure derivation over stored flags that can go stale (see the precedent comment at `app/data/index.ts:629` for `getProjectOrderStatus`).
- No new mutator, no new field on `Party` or `Project`. Recomputed on every read, which is fine at demo-data scale.
- Displayed as a small badge next to the existing `client` lifecycle status:
  - `app/pages/crm/clients.vue` (list view)
  - `app/pages/crm/parties/[id]/index.vue` (detail view)

### Data flow summary

```
Sales fills New Lead form → createLead()
Sales fills Qualification → qualifyLeadAndCreateOpportunity() → Party(prospect) + Opportunity
Opportunity pipeline: Requirement → Quotation → Commercial Approval → Client Confirmation
Sales clicks "Mark as Won" → approveOpportunityWon()
  → Party.lifecycleStatus = 'client'          (existing)
  → Project created                            (existing)
  → User(role: client, clientPartyId) created  (NEW — this feature)
  → Toast + Activity log + Portal Access card  (NEW — this feature)
Demo: Settings → Role Switcher → pick new client User → browse /client/*
Later: any Project for that Party reaches status 'completed'
  → isManovaClient(partyId) becomes true → badge appears on Clients list & Party detail  (NEW)
```

## Error Handling / Edge Cases

- **Missing lead email**: covered above — placeholder email generated, never blocks the Won transition.
- **Repeat client (Party already has a linked User)**: skip creation, reuse existing account, still show the Portal Access card and still fire the toast (reusing/confirming existing access, worded accordingly rather than claiming a brand-new account).
- **Opportunity has no `leadId`** (some historical/fixture Opportunities predate the Lead entity, per existing code comments): fall back to `opportunity.contactName` for the name, and go straight to the placeholder-email path since there's no Lead to read an email from.
- **Won guard conditions** (quotation approved, client confirmation recorded, stage `won-requested`) are unchanged — this feature only adds behavior inside the existing successful path, it doesn't alter when Won is allowed.

## Testing / Verification

No automated test suite is configured for this repo beyond Vitest scaffolding with no CRM tests currently. Verification will be manual, following the demo flow itself:
1. Create a new Lead with no email filled in → qualify → run Opportunity through to Won → confirm toast appears, placeholder email is sensible, and the new `User` shows up in Role Switcher.
2. Create a second Lead for a company that already has a client `Party`/`User` (repeat client) → Won → confirm no duplicate `User` is created.
3. Switch to the new client user via Role Switcher → confirm `/client/*` pages show that party's own Project/data (existing `clientPartyId`-scoped filtering, unchanged).
4. Manually advance that Project's status to `completed` via `updateProjectStatus` → confirm "Manova Client" badge appears on `/crm/clients` and the Party detail page.
