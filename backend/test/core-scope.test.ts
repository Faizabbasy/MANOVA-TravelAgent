import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { DEMO, makeTestApp, type TestApp } from './helpers'

/**
 * Server-side scope is the security boundary: these tests act as each role, including ID tampering in the
 * URL/query, and check both what is returned and what is withheld.
 */

let t: TestApp
const cookies: Record<string, string> = {}

beforeAll(async () => {
  // Portals are switched off by default; the scope rules stay and are tested with PORTAL_LOGIN on.
  t = await makeTestApp({ config: { portalLogin: true } })
  // A vendor that actually owns services (VND-001 flights) — the demo vendor VND-006 only holds a service order.
  await t.addUser({ id: 'USR-T-V1', email: 'vendor.one@tiket.example', role: 'vendor', vendorId: 'VND-001' })
  for (const [key, email] of Object.entries({ ...DEMO, vendorOne: 'vendor.one@tiket.example' })) cookies[key] = await t.login(email)
})
afterAll(() => t.cleanup())

const get = (who: string, path: string) => t.call('GET', path, { cookie: cookies[who] })
const ALL_PROJECTS = ['PRJ-101', 'PRJ-102', 'PRJ-103', 'PRJ-104', 'PRJ-201', 'PRJ-202', 'PRJ-203', 'PRJ-204', 'PRJ-205', 'PRJ-501', 'PRJ-502']

describe('unauthenticated', () => {
  test('every core endpoint returns 401', async () => {
    for (const path of ['/api/v1/projects', '/api/v1/projects/PRJ-101', '/api/v1/parties', '/api/v1/parties/PTY-001', '/api/v1/vendors', '/api/v1/vendors/VND-001', '/api/v1/bookings/flight/FLT-1011', '/api/v1/service-orders/SO-001']) {
      const res = await t.call('GET', path)
      expect(res.status, path).toBe(401)
      expect(res.json.error.code).toBe('UNAUTHENTICATED')
    }
  })
})

describe('internal roles', () => {
  test('finance, every admin and super-admin see every project', async () => {
    for (const who of ['finance', 'admin', 'adminSales', 'adminMgmt', 'superAdmin']) {
      const res = await get(who, '/api/v1/projects?limit=100')
      expect(res.status).toBe(200)
      expect(res.json.data.map((p: { id: string }) => p.id), who).toEqual(ALL_PROJECTS)
    }
  })

  test('cursor pagination walks every row exactly once in stable order', async () => {
    const seen: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const res = await get('finance', `/api/v1/projects?limit=3${cursor ? `&cursor=${cursor}` : ''}`)
      expect(res.json.meta.pagination.limit).toBe(3)
      seen.push(...res.json.data.map((p: { id: string }) => p.id))
      cursor = res.json.meta.pagination.nextCursor
      pages++
    } while (cursor && pages < 10)
    expect(pages).toBe(Math.ceil(ALL_PROJECTS.length / 3))
    expect(seen).toEqual(ALL_PROJECTS)
  })

  test('internal project view includes party, owner, team and provenance', async () => {
    const res = await get('admin', '/api/v1/projects/PRJ-103')
    expect(res.json.data).toMatchObject({
      id: 'PRJ-103', partyId: 'PTY-003', partyName: 'PT Sinergi Korporindo', ownerUserId: 'USR-002', teamUserIds: ['USR-002'], provenance: 'demo-fixture',
      contractValueMinor: '1400000000', contractCurrency: 'IDR'
    })
    expect(res.json.data.bookings).toContainEqual({ type: 'mice', id: 'MICE-1035' })
    expect(res.json.data.bookings).toHaveLength(12) // 3 flight + 3 hotel + 1 MICE + 5 transport
  })

  test('filters validate their input', async () => {
    expect((await get('finance', '/api/v1/projects?status=confirmed')).json.data.map((p: { id: string }) => p.id)).toEqual(['PRJ-101', 'PRJ-204'])
    expect((await get('finance', '/api/v1/projects?partyId=PTY-001')).json.data.map((p: { id: string }) => p.id)).toEqual(['PRJ-101', 'PRJ-104'])
    const badStatus = await get('finance', '/api/v1/projects?status=bogus')
    expect(badStatus.status).toBe(400)
    expect(badStatus.json.error.fieldErrors).toHaveProperty('status')
    expect((await get('finance', '/api/v1/projects?limit=101')).status).toBe(400)
    expect((await get('finance', '/api/v1/projects?limit=abc')).status).toBe(400)
  })

  test('impossible IDs and cursors are client errors, never 500 (e.g. NUL bytes)', async () => {
    expect((await get('finance', '/api/v1/projects/%00')).status).toBe(404)
    expect((await get('finance', '/api/v1/bookings/flight/%00x')).status).toBe(404)
    expect((await get('finance', '/api/v1/vendors/..')).status).toBe(404)
    expect((await get('finance', '/api/v1/projects?cursor=AA')).status).toBe(400) // decodes to "\0"
    expect((await get('finance', '/api/v1/projects?partyId=%00')).status).toBe(400)
  })

  test('typed booking reference resolves to project, service and vendor', async () => {
    const res = await get('finance', '/api/v1/bookings/flight/FLT-1011')
    expect(res.json.data).toEqual({
      type: 'flight', id: 'FLT-1011', projectId: 'PRJ-101', serviceId: 'SVC-1011', serviceType: 'flight', vendorId: 'VND-001',
      departureDate: '2026-08-20', sellAmountMinor: '95000000'
    })
    expect((await get('finance', '/api/v1/bookings/transport/TRN-1034')).json.data.vendorId).toBe('VND-003')
    const wrongType = await get('finance', '/api/v1/bookings/transportation/TRN-1034')
    expect(wrongType.status).toBe(400)
    expect((await get('finance', '/api/v1/bookings/hotel/FLT-1011')).status).toBe(404)
  })

  test('parties, vendors and service orders are readable', async () => {
    expect((await get('finance', '/api/v1/parties?limit=100')).json.data).toHaveLength(18)
    expect((await get('admin', '/api/v1/vendors?limit=100')).json.data).toHaveLength(7)
    expect((await get('finance', '/api/v1/service-orders/SO-002')).json.data).toEqual({
      id: 'SO-002', vendorId: 'VND-006', vendorName: 'PT ABC', projectId: 'PRJ-102', serviceId: null
    })
  })
})

describe('client portal (USR-021 → PTY-005)', () => {
  test('lists only its own projects, with a reduced DTO', async () => {
    const res = await get('client', '/api/v1/projects')
    expect(res.json.data.map((p: { id: string }) => p.id)).toEqual(['PRJ-201', 'PRJ-202', 'PRJ-203', 'PRJ-204'])
    expect(Object.keys(res.json.data[0]).sort()).toEqual(['destination', 'id', 'name', 'status', 'travelEndDate', 'travelStartDate'])
  })

  test('a partyId query cannot widen scope (tampering)', async () => {
    const res = await get('client', '/api/v1/projects?partyId=PTY-001')
    expect(res.json.data.map((p: { id: string }) => p.id)).toEqual(['PRJ-201', 'PRJ-202', 'PRJ-203', 'PRJ-204'])
  })

  test("another customer's project, booking or party is 404, not 403 (no existence leak)", async () => {
    for (const path of ['/api/v1/projects/PRJ-101', '/api/v1/bookings/flight/FLT-1011', '/api/v1/parties/PTY-001', '/api/v1/vendors/VND-001', '/api/v1/service-orders/SO-002']) {
      const res = await get('client', path)
      expect(res.status, path).toBe(404)
      expect(res.json.error.code).toBe('NOT_FOUND')
    }
  })

  test('reads its own party but cannot list parties or vendors', async () => {
    const own = await get('client', '/api/v1/parties/PTY-005')
    expect(own.status).toBe(200)
    expect(own.json.data).not.toHaveProperty('provenance')
    expect((await get('client', '/api/v1/parties')).status).toBe(403)
    expect((await get('client', '/api/v1/vendors')).status).toBe(403)
  })
})

describe('vendor portal', () => {
  test('demo vendor VND-006 sees PRJ-102 through its service order, and nothing else', async () => {
    const res = await get('vendor', '/api/v1/projects')
    expect(res.json.data.map((p: { id: string }) => p.id)).toEqual(['PRJ-102'])
    const detail = await get('vendor', '/api/v1/projects/PRJ-102')
    expect(detail.json.data).not.toHaveProperty('partyId')
    expect(detail.json.data.bookings).toEqual([]) // none of PRJ-102's bookings is on a VND-006 service
    expect((await get('vendor', '/api/v1/projects/PRJ-101')).status).toBe(404)
  })

  test('a vendor sees only bookings on its own services, as a reduced DTO', async () => {
    const own = await get('vendorOne', '/api/v1/bookings/flight/FLT-1011')
    expect(own.status).toBe(200)
    expect(own.json.data).toEqual({ type: 'flight', id: 'FLT-1011', projectId: 'PRJ-101' })
    // Same project family, but a hotel on VND-002's service
    expect((await get('vendorOne', '/api/v1/bookings/hotel/HTL-1033')).status).toBe(404)
    // Booking without any service: cannot be attributed to the vendor
    expect((await get('vendorOne', '/api/v1/bookings/flight/FLT-1033')).status).toBe(404)

    const prj103 = await get('vendorOne', '/api/v1/projects/PRJ-103')
    expect(prj103.json.data.bookings).toEqual([{ type: 'flight', id: 'FLT-1031' }, { type: 'flight', id: 'FLT-1032' }])
  })

  test('reads only its own vendor record and service orders', async () => {
    expect((await get('vendor', '/api/v1/vendors/VND-006')).status).toBe(200)
    expect((await get('vendor', '/api/v1/vendors/VND-001')).status).toBe(404)
    expect((await get('vendor', '/api/v1/service-orders/SO-002')).status).toBe(200)
    expect((await get('vendor', '/api/v1/service-orders/SO-001')).status).toBe(404)
    expect((await get('vendor', '/api/v1/parties/PTY-002')).status).toBe(404)
    expect((await get('vendor', '/api/v1/parties')).status).toBe(403)
  })
})
