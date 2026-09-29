import { reactive } from 'vue'

/**
 * Finance facts the operational (still client-side) project workflow gates on, received from the server
 * (`GET /finance/overview`, status-only, no amounts). Finance records live on the server now, so the
 * workflow must never look at the old mock invoices: until a project's facts have been loaded, its DP gates
 * say so instead of guessing.
 */
export interface ProjectFinanceFacts {
  /** A DP invoice has been issued. */
  dpInvoiced: boolean
  /** Money has been received on an issued DP invoice. */
  dpReceived: boolean
}

const FACTS = reactive(new Map<string, ProjectFinanceFacts>())

export function setProjectFinanceFacts (projects: ({ projectId: string } & ProjectFinanceFacts)[]) {
  for (const p of projects) { FACTS.set(p.projectId, { dpInvoiced: p.dpInvoiced, dpReceived: p.dpReceived }) }
}

export function getProjectFinanceFacts (projectId: string): ProjectFinanceFacts | undefined {
  return FACTS.get(projectId)
}

/** Tests only. */
export function resetProjectFinanceFacts () {
  FACTS.clear()
}
