import { reactive } from 'vue'
import type { QuotationAttachment, QuotationComment } from '~/types/opportunity'

/**
 * Quotation attachment/comment mock (Repair Phase Section 3 — Request & Commercial). Array kosong dengan
 * sengaja — belum ada Quotation demo (PTY-005 belum punya Opportunity, lihat `docs/client-mock-data-scenarios.md`)
 * yang butuh contoh attachment/comment sejak awal; keduanya terisi natural begitu Client berinteraksi
 * lewat `/client/quotations/[id]` (upload mock/komentar) atau lewat mock review Travel Request.
 */
export const QUOTATION_ATTACHMENTS: QuotationAttachment[] = reactive([])
export const QUOTATION_COMMENTS: QuotationComment[] = reactive([])
