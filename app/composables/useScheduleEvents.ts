import { computed } from 'vue'
import { PROJECTS, ITINERARY_ITEMS, FLIGHT_BOOKINGS, HOTEL_BOOKINGS, TRANSPORT_BOOKINGS, MICE_EVENTS, getProjectById } from '~/data'
import { PROJECT_MILESTONES } from '~/data/project-orders'
import { MAINTENANCE_SCHEDULES, getAssetById } from '~/data/inventory'
import { getMilestoneDelayDays } from '~/data/project-order-workflow'
import type { BadgeTone } from '~/types/common'

export type ScheduleEventKind =
  | 'departure'
  | 'return'
  | 'itinerary'
  | 'milestone'
  | 'flight'
  | 'hotel'
  | 'transport'
  | 'mice'
  | 'maintenance'

export interface ScheduleEvent {
  id: string
  date: string
  kind: ScheduleEventKind
  title: string
  detail?: string
  projectId?: string
  tone: BadgeTone
  /** Menandai item yang butuh perhatian (mis. milestone telat, maintenance terlewat). */
  isAttention?: boolean
}

const KIND_META: Record<ScheduleEventKind, { label: string; tone: BadgeTone }> = {
  departure: { label: 'Keberangkatan', tone: 'primary' },
  return: { label: 'Kepulangan', tone: 'info' },
  itinerary: { label: 'Itinerary', tone: 'neutral' },
  milestone: { label: 'Milestone', tone: 'purple' },
  flight: { label: 'Penerbangan', tone: 'info' },
  hotel: { label: 'Akomodasi', tone: 'success' },
  transport: { label: 'Transportasi', tone: 'warning' },
  mice: { label: 'MICE', tone: 'purple' },
  maintenance: { label: 'Maintenance', tone: 'destructive' }
}

export const SCHEDULE_KIND_META = KIND_META

/**
 * Booking Calendar (Revisi 9-Modul, `revisi.md` #13 — "buatkan kalender untuk jadwal").
 *
 * TIDAK memperkenalkan entitas jadwal baru. Kalender adalah VIEW gabungan atas jadwal yang sudah tersebar
 * di berbagai modul — keberangkatan/kepulangan project, itinerary harian, milestone Project Order, booking
 * flight/hotel/transport/MICE, dan jadwal maintenance aset. Karena murni derivasi, kalender tidak mungkin
 * menampilkan jadwal yang berbeda dari halaman asalnya.
 */
export function useScheduleEvents () {
  const events = computed<ScheduleEvent[]>(() => {
    const list: ScheduleEvent[] = []

    for (const project of PROJECTS) {
      if (project.status === 'cancelled') { continue }
      list.push({
        id: `SCH-DEP-${project.id}`,
        date: project.travelStartDate,
        kind: 'departure',
        title: `Berangkat — ${project.name}`,
        detail: `${project.destination} · ${project.travelerCount} pax`,
        projectId: project.id,
        tone: KIND_META.departure.tone
      })
      list.push({
        id: `SCH-RET-${project.id}`,
        date: project.travelEndDate,
        kind: 'return',
        title: `Kembali — ${project.name}`,
        detail: project.destination,
        projectId: project.id,
        tone: KIND_META.return.tone
      })
    }

    for (const item of ITINERARY_ITEMS) {
      list.push({
        id: `SCH-ITN-${item.id}`,
        date: item.date,
        kind: 'itinerary',
        title: item.title,
        detail: [item.time, item.location].filter(Boolean).join(' · ') || undefined,
        projectId: item.projectId,
        tone: KIND_META.itinerary.tone
      })
    }

    for (const milestone of PROJECT_MILESTONES) {
      const delay = getMilestoneDelayDays(milestone)
      const isLate = delay !== undefined && delay > 0 && milestone.status !== 'completed'
      list.push({
        id: `SCH-MST-${milestone.id}`,
        date: milestone.actualDate ?? milestone.plannedDate,
        kind: 'milestone',
        title: milestone.name,
        detail: getProjectById(milestone.projectId)?.name,
        projectId: milestone.projectId,
        tone: isLate ? 'destructive' : KIND_META.milestone.tone,
        isAttention: isLate
      })
    }

    for (const booking of FLIGHT_BOOKINGS) {
      const date = booking.segments?.[0]?.departureAt?.slice(0, 10)
      if (!date) { continue }
      list.push({
        id: `SCH-FLT-${booking.id}`,
        date,
        kind: 'flight',
        title: `Penerbangan ${booking.id}`,
        detail: booking.pnr ? `PNR ${booking.pnr}` : undefined,
        projectId: booking.projectId,
        tone: KIND_META.flight.tone
      })
    }

    for (const booking of HOTEL_BOOKINGS) {
      if (!booking.checkInDate) { continue }
      /** Nama properti ada di opsi yang dipilih, bukan di booking-nya langsung. */
      const property = booking.options?.find(option => option.isSelected)?.propertyName
      list.push({
        id: `SCH-HTL-${booking.id}`,
        date: booking.checkInDate,
        kind: 'hotel',
        title: `Check-in ${property ?? booking.id}`,
        detail: booking.checkOutDate ? `s/d ${booking.checkOutDate}` : undefined,
        projectId: booking.projectId,
        tone: KIND_META.hotel.tone
      })
    }

    for (const booking of TRANSPORT_BOOKINGS) {
      const leg = booking.legs?.[0]
      const date = leg?.scheduledAt?.slice(0, 10)
      if (!date) { continue }
      list.push({
        id: `SCH-TRP-${booking.id}`,
        date,
        kind: 'transport',
        title: `Transportasi ${booking.id}`,
        detail: leg?.pickupLocation,
        projectId: booking.projectId,
        tone: KIND_META.transport.tone
      })
    }

    for (const event of MICE_EVENTS) {
      /** `MiceEvent` tidak punya tanggal sendiri — tanggal event diambil dari sesi paling awal. */
      const date = [...(event.sessions ?? [])].map(session => session.startAt).sort()[0]?.slice(0, 10)
      if (!date) { continue }
      list.push({
        id: `SCH-MIC-${event.id}`,
        date,
        kind: 'mice',
        title: event.venueName ? `MICE — ${event.venueName}` : `MICE ${event.id}`,
        detail: event.sessions?.[0]?.sessionTitle,
        projectId: event.projectId,
        tone: KIND_META.mice.tone
      })
    }

    for (const schedule of MAINTENANCE_SCHEDULES) {
      list.push({
        id: `SCH-MNT-${schedule.id}`,
        date: schedule.completedAt ?? schedule.scheduledAt,
        kind: 'maintenance',
        title: `Maintenance — ${getAssetById(schedule.assetId)?.name ?? schedule.assetId}`,
        detail: schedule.vendorName,
        tone: schedule.status === 'overdue' ? 'destructive' : 'warning',
        isAttention: schedule.status === 'overdue'
      })
    }

    return list.sort((a, b) => a.date.localeCompare(b.date))
  })

  function eventsOn (dateIso: string): ScheduleEvent[] {
    return events.value.filter(event => event.date === dateIso)
  }

  function eventsBetween (startIso: string, endIso: string): ScheduleEvent[] {
    return events.value.filter(event => event.date >= startIso && event.date <= endIso)
  }

  return { events, eventsOn, eventsBetween, kindMeta: KIND_META }
}
