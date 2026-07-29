import type { Vendor } from '~/types/vendor'

/** docs/mockup-data-scenarios.md bagian 0.2 — nama fiktif, bukan brand nyata (D-006). */
export const VENDORS: Vendor[] = [
  { id: 'VND-001', name: 'CV Tiket Mitra Nusantara', serviceType: 'flight', contactName: 'Yusuf Maulana' },
  { id: 'VND-002', name: 'Hotel Prima Mitra', serviceType: 'hotel', contactName: 'Rina Kartika' },
  { id: 'VND-003', name: 'Trans Wahana Logistik', serviceType: 'transportation', contactName: 'Bimo Saputro' },
  { id: 'VND-004', name: 'Cendana MICE Organizer', serviceType: 'mice', contactName: 'Wulan Permatasari' },
  { id: 'VND-005', name: 'CV Wisata Kargo Ekspres', serviceType: 'transportation', contactName: 'Agus Salim' },
]
