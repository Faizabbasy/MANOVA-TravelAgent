/** S12c-1: a client's proposed change to sensitive company data, shown field by field for the reviewer. */
const LABELS: Record<string, string> = {
  name: 'Nama perusahaan', npwp: 'NPWP', registrationNumber: 'No. registrasi', billingName: 'Nama billing', billingAddress: 'Alamat billing', paymentTerm: 'Termin bayar'
}

export function profileChangeRows (changes: Record<string, string | null | undefined>, current: Record<string, string | null | undefined>) {
  return Object.entries(changes).map(([field, proposed]) => ({
    field,
    label: LABELS[field] ?? field,
    current: current[field] ? String(current[field]) : '—',
    proposed: proposed ? String(proposed) : '(dikosongkan)'
  }))
}
