import { reactive } from 'vue'
import type { Approval } from '~/types/client-approval'

/**
 * Client Approval (Repair Phase Section 3 — Request & Commercial, menggantikan Foundation Section 1 yang
 * sengaja kosong). `CAPP-001` menaut ke `CR-007` (`app/data/change-incident.ts`, skenario "Singapore
 * Conference" — perubahan besar dengan cancellation fee, `status: 'under-review'`) — dampak operasional/
 * komersial/finansial CR-007 SUDAH tersedia (`operationalImpact`/`commercialImpactIdr`/`financialImpactNote`
 * terisi), persis tahap "Availability and cost impact created" (Master Prompt Flow 5) sebelum Client
 * approve. Approve/Reject di Approval Center men-sinkronkan `ChangeRequest.status` lewat
 * `approveChangeRequest`/`rejectChangeRequest` existing (LOCKED, Section 19) — TIDAK memutasi field lain.
 * `requestedBy: 'USR-002'` — Project Manager pemilik PRJ-204 (`app/data/projects.ts`), pihak yang meminta
 * keputusan Client atas dampak perubahan ini.
 */
export const CLIENT_APPROVALS: Approval[] = reactive([
  {
    id: 'CAPP-001',
    projectId: 'PRJ-204',
    clientPartyId: 'PTY-005',
    entityType: 'change-request',
    entityId: 'CR-007',
    status: 'pending',
    requestedAt: '2026-07-24',
    requestedBy: 'USR-002'
  }
])
