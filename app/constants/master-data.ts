/**
 * Master data constants — Section 17 (Administration).
 * Dipakai oleh /admin/master-data dan referensi lintas-modul.
 * Tidak ada backend CRUD — data bersifat read-only fixture untuk demo.
 */

export interface MasterDataItem {
  id: string
  label: string
  description?: string
  isActive: boolean
}

/** Tipe project (karakteristik) — sesuai PROJECT_CHARACTERISTICS (docs/route-and-role-matrix.md bagian 3). */
export const MASTER_PROJECT_TYPES: MasterDataItem[] = [
  { id: 'PT-001', label: 'Normal Project', description: 'Perjalanan standar tanpa kompleksitas tinggi', isActive: true },
  { id: 'PT-002', label: 'High-Change Project', description: 'Perjalanan dengan banyak perubahan itinerary/pax selama proses', isActive: true },
  { id: 'PT-003', label: 'Complex Project', description: 'Perjalanan multi-destination, multi-vendor, atau multi-grup besar', isActive: true },
]

/** Tipe layanan operasional — sesuai SERVICE_TYPES (docs/route-and-role-matrix.md bagian 4). */
export const MASTER_SERVICE_TYPES: MasterDataItem[] = [
  { id: 'ST-001', label: 'Flight', description: 'Tiket pesawat dan penerbangan', isActive: true },
  { id: 'ST-002', label: 'Hotel', description: 'Akomodasi penginapan', isActive: true },
  { id: 'ST-003', label: 'Transportation', description: 'Transportasi darat, bus, shuttle, dll.', isActive: true },
  { id: 'ST-004', label: 'MICE', description: 'Meeting, Incentive, Conference, Exhibition', isActive: true },
  { id: 'ST-005', label: 'Additional Service', description: 'Layanan tambahan di luar kategori utama', isActive: true },
]

/** Destinasi demo — konsisten dengan skenario PRJ-101/102/103 (docs/mockup-data-scenarios.md). */
export const MASTER_DESTINATIONS: MasterDataItem[] = [
  { id: 'DST-001', label: 'Manila, Filipina', description: 'Asia Tenggara', isActive: true },
  { id: 'DST-002', label: 'Abu Dhabi, UAE', description: 'Timur Tengah', isActive: true },
  { id: 'DST-003', label: 'Palu, Indonesia', description: 'Domestik — Sulawesi Tengah', isActive: true },
  { id: 'DST-004', label: 'Bali, Indonesia', description: 'Domestik — Bali', isActive: true },
  { id: 'DST-005', label: 'Singapura', description: 'Asia Tenggara', isActive: true },
  { id: 'DST-006', label: 'Tokyo, Jepang', description: 'Asia Timur', isActive: true },
  { id: 'DST-007', label: 'Bangkok, Thailand', description: 'Asia Tenggara', isActive: false },
]

/** Kategori vendor — sesuai jenis layanan yang dikerjakan vendor (docs/mockup-data-scenarios.md bagian 0.2). */
export const MASTER_VENDOR_CATEGORIES: MasterDataItem[] = [
  { id: 'VC-001', label: 'Maskapai / Airline', description: 'Vendor tiket pesawat', isActive: true },
  { id: 'VC-002', label: 'Hotel / Penginapan', description: 'Vendor akomodasi', isActive: true },
  { id: 'VC-003', label: 'Transportasi Darat', description: 'Vendor bus, shuttle, rental kendaraan', isActive: true },
  { id: 'VC-004', label: 'MICE Organizer', description: 'Vendor penyelenggara event/meeting', isActive: true },
  { id: 'VC-005', label: 'Kargo / Ekspedisi', description: 'Vendor logistik dan kargo', isActive: true },
  { id: 'VC-006', label: 'Asuransi Perjalanan', description: 'Vendor asuransi untuk traveler', isActive: false },
]
