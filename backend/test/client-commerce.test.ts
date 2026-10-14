import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * S12a-2: the client portal's commercial reads — sent quotations, reservations without money, and the client's own
 * invoices — through /client/* with whitelist DTOs. Client USR-021, party PTY-005.
 */

let t: TestApp
const c: Record<string, string> = {}
beforeAll(async () => {
  t = await makeTestApp()
  for (const [k, email] of Object.entries(DEMO)) c[k] = await t.login(email)
}, 60_000)
afterAll(() => t.cleanup())

const get = (path: string, who: string) => t.call('GET', `/api/v1${path}`, { cookie: c[who] })
/** Every key of an object, nested objects and arrays included. */
const keysOf = (v: unknown, into = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach(x => keysOf(x, into))
  else if (v && typeof v === 'object') for (const [k, child] of Object.entries(v)) { into.add(k); keysOf(child, into) }
  return into
}

describe('GET /client/reservations', () => {
  test('bookings of the client party’s projects, without any money, vendor or internal note', async () => {
    // Give the client party a project with a booking of each type, and plant internal fields in the details.
    for (const type of ['flight', 'hotel', 'transport', 'mice']) {
      await t.db.query(`update projects set party_id = 'PTY-005' where id = (select project_id from booking_refs where booking_type = $1 order by booking_id limit 1)`, [type])
    }
    await t.db.query(`update booking_refs set details = details || $1::text::jsonb where booking_type = 'flight'`, [JSON.stringify({
      options: [{ airline: 'Garuda Indonesia', cabinClass: 'economy', isSelected: true, fareIdr: 5000000 }],
      segments: [{ origin: 'CGK', destination: 'DPS', departureAt: '2026-11-01T08:00', arrivalAt: '2026-11-01T11:00', flightNumber: 'GA402' }],
      scheduleChangeNote: 'internal', ticketingDeadline: '2026-10-25'
    })])
    await t.db.query(`update booking_refs set details = details || $1::text::jsonb where booking_type = 'mice'`, [JSON.stringify({
      venueName: 'Bali Convention', boqItems: [{ vendorId: 'VND-001', netCostIdr: 1000000, sellPriceIdr: 1500000 }],
      sessions: [{ roomName: 'Ballroom', sessionTitle: 'Opening', startAt: '2026-11-02T09:00', endAt: '2026-11-02T10:00', capacity: 200, picUserId: 'USR-002' }],
      staffAssignments: [{ userId: 'USR-002' }], checklist: [{ label: 'x' }]
    })])

    const res = await get('/client/reservations', 'client')
    expect(res.status).toBe(200)
    const rows = res.json.data as { type: string; id: string; projectId: string; clientStatus: string; details: Record<string, unknown> }[]
    const expected = await t.db.query<{ n: string }>("select count(*)::text as n from booking_refs b join projects p on p.id = b.project_id where p.party_id = 'PTY-005'")
    expect(rows.length).toBe(Number(expected[0]!.n))
    expect(new Set(rows.map(r => r.type))).toEqual(new Set(['flight', 'hotel', 'transport', 'mice']))
    expect(rows.every(r => ['Diproses', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'].includes(r.clientStatus))).toBe(true)
    const flight = rows.find(r => r.type === 'flight' && (r.details.segments as unknown[]).length)!
    expect(flight.details).toMatchObject({ airline: 'Garuda Indonesia', cabinClass: 'economy', ticketingDeadline: '2026-10-25' })
    const keys = keysOf(rows)
    for (const k of ['sellAmountMinor', 'netCostMinor', 'vendorId', 'serviceId', 'options', 'fareIdr', 'ratePerNightIdr', 'ratePerUnitIdr', 'boqItems',
      'netCostIdr', 'sellPriceIdr', 'statusReason', 'paymentGate', 'attempts', 'flaggedDuplicate', 'duplicateOf', 'duplicateNote', 'picUserId',
      'staffAssignments', 'checklist', 'scheduleChangeNote', 'amendmentNote', 'changeNote', 'incidentNote', 'changeOrderNote', 'tollFeeIdr']) {
      expect(keys.has(k), k).toBe(false)
    }
    expect((await get('/client/reservations', 'admin')).status).toBe(403)
  })
})

describe('GET /client/quotations', () => {
  test('only sent quotations of the client party, without cost, margin, markup or approval internals', async () => {
    // Make the client party own one sent and one unsent quotation, whatever the seed has.
    const leads = await t.db.query<{ id: string }>("select l.id from leads l join quotations q on q.lead_id = l.id order by l.id limit 2")
    await t.db.query("update leads set party_id = 'PTY-005' where id = any($1::text[])", [leads.map(l => l.id)])
    await t.db.query("update quotations set sent_to_client_on = '2026-07-01' where lead_id = $1", [leads[0]!.id])
    await t.db.query("update quotation_versions v set status = 'approved' from quotations q where q.id = v.quotation_id and q.lead_id = $1 and v.version = q.current_version", [leads[0]!.id])
    await t.db.query('update quotations set sent_to_client_on = null where lead_id = $1', [leads[1]!.id])

    const res = await get('/client/quotations', 'client')
    expect(res.status).toBe(200)
    const rows = res.json.data as { id: string; lead: { id: string }; amountMinor: string; sentToClientOn: string }[]
    const expected = await t.db.query<{ id: string }>(
      "select q.id from quotations q join leads l on l.id = q.lead_id where l.party_id = 'PTY-005' and q.sent_to_client_on is not null order by q.id")
    expect(rows.map(r => r.id).sort()).toEqual(expected.map(r => r.id))
    expect(rows.some(r => r.lead.id === leads[0]!.id)).toBe(true)
    expect(rows.some(r => r.lead.id === leads[1]!.id)).toBe(false) // not sent
    expect(rows.every(r => r.sentToClientOn && /^\d+$/.test(r.amountMinor))).toBe(true)
    const keys = keysOf(rows)
    for (const k of ['markupMinor', 'estimatedCostMinor', 'estimatedMarginMinor', 'costSheetId', 'decisionNote', 'decidedBy', 'submittedBy',
      'ownerUserId', 'qualificationNotes', 'budgetRange', 'decisionMaker', 'urgency', 'source', 'stage', 'createdBy']) {
      expect(keys.has(k), k).toBe(false)
    }
  })

  test('other roles are refused', async () => {
    for (const who of ['admin', 'finance', 'vendor']) expect((await get('/client/quotations', who)).status, who).toBe(403)
    expect((await t.call('GET', '/api/v1/client/quotations')).status).toBe(401)
  })
})
