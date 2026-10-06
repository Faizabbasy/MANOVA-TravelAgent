import { describe, it, expect, afterEach } from 'vitest'
import { PROJECTS } from './projects'
import { getProjectMilestones } from './project-order-workflow'
import { createProjectOnServer, loadServerProjects, mergeServerProjects, patchProjectOnServer, registerNewServerProject, upsertServerProject } from './projects-sync'
import { serverProjectDto } from './projects-sync.test-utils'

const original = PROJECTS.map(p => ({ ...p }))
afterEach(() => { PROJECTS.splice(0, PROJECTS.length, ...original.map(p => ({ ...p }))) })

describe('projects-sync', () => {
  it('memperbarui project yang ada di tempat (objek sama) dan mempertahankan field lokal', () => {
    const before = PROJECTS.find(p => p.id === 'PRJ-101')!
    const budget = before.budgetIdr
    upsertServerProject(serverProjectDto({ id: 'PRJ-101', name: 'Manila Baru', destination: 'Cebu, Filipina', contractValueMinor: '99000000', tourLeaderName: 'Andi' }))
    const after = PROJECTS.find(p => p.id === 'PRJ-101')!
    expect(after).toBe(before)
    expect(after).toMatchObject({ name: 'Manila Baru', destination: 'Cebu, Filipina', quotationAmountIdr: 99_000_000, tourLeaderName: 'Andi', budgetIdr: budget })
  })

  it('nilai kontrak null (peran tanpa nominal) tidak menimpa nilai lokal', () => {
    const local = PROJECTS.find(p => p.id === 'PRJ-102')!.quotationAmountIdr
    upsertServerProject(serverProjectDto({ id: 'PRJ-102', contractValueMinor: null }))
    expect(PROJECTS.find(p => p.id === 'PRJ-102')!.quotationAmountIdr).toBe(local)
  })

  it('project baru dari server ditambahkan dengan default field lokal dan milestone standar', () => {
    const project = registerNewServerProject(serverProjectDto({ id: 'PRJ-950' }))
    expect(PROJECTS.at(-1)).toBe(project)
    expect(project).toMatchObject({ id: 'PRJ-950', status: 'draft', budgetIdr: 0, actualCostIdr: 0, quotationAmountIdr: 100_000_000, serviceScope: ['flight'] })
    expect(getProjectMilestones('PRJ-950')).toHaveLength(8)
  })

  it('merge menghapus project lokal yang tidak ada di server dan mengabaikan DTO portal', () => {
    mergeServerProjects([serverProjectDto({ id: 'PRJ-101' }), serverProjectDto({ id: 'PRJ-960' })])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-960'])
    mergeServerProjects([{ id: 'PRJ-101', name: 'x', destination: null, travelStartDate: null, travelEndDate: null, status: 'draft' }])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-960'])
  })
})

describe('loadServerProjects', () => {
  it('mengambil semua halaman lalu menggabungkan', async () => {
    const pages = [
      { data: [serverProjectDto({ id: 'PRJ-101' })], meta: { pagination: { nextCursor: 'PRJ-101' } } },
      { data: [serverProjectDto({ id: 'PRJ-970' })], meta: { pagination: { nextCursor: null } } }
    ]
    const cursors: (string | undefined)[] = []
    const api = { core: { listProjects: async (q: { cursor?: string }) => { cursors.push(q.cursor); return pages.shift()! } } }
    expect(await loadServerProjects(api as never)).toBe(2)
    expect(cursors).toEqual([undefined, 'PRJ-101'])
    expect(PROJECTS.map(p => p.id)).toEqual(['PRJ-101', 'PRJ-970'])
  })

  it('server mati: array lokal tidak disentuh dan error diteruskan', async () => {
    const ids = PROJECTS.map(p => p.id)
    const api = { core: { listProjects: async () => { throw new Error('down') } } }
    await expect(loadServerProjects(api as never)).rejects.toThrow('down')
    expect(PROJECTS.map(p => p.id)).toEqual(ids)
  })
})

describe('createProjectOnServer', () => {
  it('mengirim nilai kontrak sebagai minor string dan mendaftarkan hasil server', async () => {
    const sent: unknown[] = []
    const api = { core: { createProject: async (input: unknown, key: string) => { sent.push({ input, key }); return { data: serverProjectDto({ id: 'PRJ-341', name: 'Trip Baru' }) } } } }
    const project = await createProjectOnServer(api as never, {
      partyId: 'PTY-002', name: 'Trip Baru', destination: 'Bali', travelStartDate: '2027-01-10', travelEndDate: '2027-01-12',
      travelerCount: 4, serviceScope: ['hotel'], quotationAmountIdr: 150_000_000
    }, 'key-abc-12345')
    expect(sent).toEqual([{ input: expect.objectContaining({ partyId: 'PTY-002', contractValueMinor: '150000000', serviceScope: ['hotel'] }), key: 'key-abc-12345' }])
    expect(project.id).toBe('PRJ-341')
    expect(PROJECTS.some(p => p.id === 'PRJ-341')).toBe(true)
  })

  it('error server diteruskan dan tidak ada project lokal yang dibuat', async () => {
    const count = PROJECTS.length
    const api = { core: { createProject: async () => { throw new Error('422') } } }
    await expect(createProjectOnServer(api as never, {
      partyId: 'PTY-999', name: 'X', destination: 'Y', travelStartDate: '2027-01-10', travelEndDate: '2027-01-12', travelerCount: 1, serviceScope: ['hotel'], quotationAmountIdr: 1
    }, 'key-abc-67890')).rejects.toThrow('422')
    expect(PROJECTS.length).toBe(count)
  })
})

describe('patchProjectOnServer', () => {
  it('mengirim patch dan menerapkan jawaban server ke objek yang sama', async () => {
    const before = PROJECTS.find(p => p.id === 'PRJ-101')!
    const api = { core: { updateProject: async (id: string, input: Record<string, unknown>) => ({ data: serverProjectDto({ id, destination: input.destination as string, meetingPoint: 'Terminal 3' }) }) } }
    const project = await patchProjectOnServer(api as never, 'PRJ-101', { destination: 'Cebu, Filipina', meetingPoint: 'Terminal 3' })
    expect(project).toBe(before)
    expect(before).toMatchObject({ destination: 'Cebu, Filipina', meetingPoint: 'Terminal 3' })
  })
})
