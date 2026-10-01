/**
 * Template preset milestone untuk form "+ Buat Invoice" (Project Detail, tab Finance) — titik awal yang
 * cepat diisi lalu tetap bisa diedit (label/persen) atau ditambah/dihapus manual sebelum invoice disimpan
 * (lihat `createInvoice`, `app/data/index.ts`, yang memvalidasi total persen harus 100).
 */
export interface InvoiceMilestoneTemplateRow {
  label: string
  percent: number
}

export interface InvoiceMilestoneTemplate {
  key: string
  label: string
  milestones: InvoiceMilestoneTemplateRow[]
}

export const INVOICE_MILESTONE_TEMPLATES: InvoiceMilestoneTemplate[] = [
  {
    key: 'dp-termin-final',
    label: 'DP 40% / Termin 1 30% / Final 30%',
    milestones: [
      { label: 'Down Payment', percent: 40 },
      { label: 'Termin 1', percent: 30 },
      { label: 'Final Payment', percent: 30 }
    ]
  },
  {
    key: 'dp-final',
    label: 'DP 50% / Final 50%',
    milestones: [
      { label: 'Down Payment', percent: 50 },
      { label: 'Final Payment', percent: 50 }
    ]
  },
  {
    key: 'full',
    label: 'Full Payment 100%',
    milestones: [
      { label: 'Full Payment', percent: 100 }
    ]
  }
]
