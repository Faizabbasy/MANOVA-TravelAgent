import { reactive } from 'vue'
import type { ItineraryVersion, ItineraryComment } from '~/types/itinerary-version'

/**
 * Itinerary Version (Repair Phase Section 4 — Core Project, menggantikan Foundation Section 1 yang sengaja
 * kosong). Version 1 untuk PRJ-201–204 = snapshot `ITINERARY_ITEMS` existing (`app/data/projects.ts`) pada
 * masing-masing project — status mengikuti narasi skenario `docs/client-mock-data-scenarios.md`: PRJ-201
 * (Korea) `waiting-approval` (persis narasi Skenario A "Itinerary waiting approval"), PRJ-202 (Abu Dhabi,
 * trip berjalan) `approved`, PRJ-203 (Manila, selesai) `final`, PRJ-204 (Singapore, confirmed) `approved`.
 */
export const ITINERARY_VERSIONS: ItineraryVersion[] = reactive([
  {
    id: 'ITVER-001',
    projectId: 'PRJ-201',
    versionNumber: 1,
    status: 'waiting-approval',
    items: [
      { id: 'ITIN-2011', projectId: 'PRJ-201', date: '2026-10-12', time: '09:00', title: 'Keberangkatan Jakarta → Seoul', serviceType: 'flight', timezone: 'Asia/Jakarta' },
      { id: 'ITIN-2012', projectId: 'PRJ-201', date: '2026-10-16', time: '18:00', title: 'Kepulangan Seoul → Jakarta', serviceType: 'flight', timezone: 'Asia/Seoul' }
    ],
    createdAt: '2026-08-01',
    createdBy: 'USR-002'
  },
  {
    id: 'ITVER-002',
    projectId: 'PRJ-202',
    versionNumber: 1,
    status: 'approved',
    items: [
      { id: 'ITIN-2021', projectId: 'PRJ-202', date: '2026-07-26', time: '09:00', title: 'Delegasi Bisnis — Hari 1', timezone: 'Asia/Dubai' },
      { id: 'ITIN-2022', projectId: 'PRJ-202', date: '2026-08-02', time: '14:00', title: 'Kepulangan Abu Dhabi → Jakarta', serviceType: 'flight', timezone: 'Asia/Dubai' }
    ],
    createdAt: '2026-07-20',
    createdBy: 'USR-002'
  },
  {
    id: 'ITVER-003',
    projectId: 'PRJ-203',
    versionNumber: 1,
    status: 'final',
    items: [
      { id: 'ITIN-2031', projectId: 'PRJ-203', date: '2026-06-11', time: '09:00', title: 'Corporate Meeting', timezone: 'Asia/Manila' }
    ],
    createdAt: '2026-05-25',
    createdBy: 'USR-002'
  },
  {
    id: 'ITVER-004',
    projectId: 'PRJ-204',
    versionNumber: 1,
    status: 'approved',
    items: [
      { id: 'ITIN-2041', projectId: 'PRJ-204', date: '2026-11-06', time: '09:00', title: 'Conference — Hari 1', timezone: 'Asia/Singapore' }
    ],
    createdAt: '2026-07-15',
    createdBy: 'USR-002'
  }
])

export const ITINERARY_COMMENTS: ItineraryComment[] = reactive([])
