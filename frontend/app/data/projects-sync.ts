import { PROJECTS } from './projects'
import { resolveDestinationGeo } from './geo'
import { evaluateProjectOrderStepGate, getProjectOrderStep, getProjectOrderStepDef, type AdvanceProjectOrderOptions, type AdvanceProjectOrderResult } from './project-order-workflow'
import { reloadProjectMilestones } from './work-items-sync'
import type { CreateProjectInput } from './index'
import type { Project, ProjectStatus } from '~/types/project'
import type { ProjectOrderGateResult, ProjectOrderStepKey } from '~/types/project-order'
import { isInternalProject, type ProjectDto, type ProjectInternalDto, type ProjectPatchInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `PROJECTS` (S3a, spec 2026-10-06-project-core-backend). The server owns the project header
 * (name, customer, dates, travelers, scope, contract value, field contacts); fields whose stage has not moved
 * yet (status workflow, handover, closure, budget, photo) stay in the local object. Objects are updated in
 * place so every page holding a reference keeps working.
 */

const DEFAULT_OWNER_ID = 'USR-002'

function serverFields (dto: ProjectInternalDto, local?: Project): Partial<Project> {
  const destination = dto.destination ?? local?.destination ?? ''
  return {
    id: dto.id,
    name: dto.name,
    partyId: dto.partyId,
    isGroupTrip: dto.isGroupTrip || undefined,
    leadId: dto.leadId ?? undefined,
    sourceQuotationId: dto.sourceQuotationId ?? undefined,
    destination,
    ...(destination !== local?.destination ? { destinationGeo: resolveDestinationGeo(destination) } : {}),
    travelStartDate: dto.travelStartDate ?? local?.travelStartDate ?? '',
    travelEndDate: dto.travelEndDate ?? local?.travelEndDate ?? '',
    characteristic: dto.characteristic,
    serviceScope: [...dto.serviceScope],
    travelerCount: dto.travelerCount,
    ownerId: dto.ownerUserId ?? local?.ownerId ?? DEFAULT_OWNER_ID,
    // S3b: status, workflow and team are owned by the server.
    teamUserIds: [...dto.teamUserIds],
    status: dto.status,
    handoverAcceptedAt: dto.handoverAcceptedAt ?? undefined,
    handoverAcceptedBy: dto.handoverAcceptedBy ?? undefined,
    handoverReturnedAt: dto.handoverReturnedAt ?? undefined,
    handoverReturnReason: dto.handoverReturnReason ?? undefined,
    readyAt: dto.readyAt ?? undefined,
    closedAt: dto.closedAt ?? undefined,
    closedBy: dto.closedBy ?? undefined,
    closureChecklist: closureFrom(dto, local),
    quotationAmountIdr: dto.contractValueMinor !== null ? Number(dto.contractValueMinor) : local?.quotationAmountIdr ?? 0,
    tourLeaderName: dto.tourLeaderName ?? undefined,
    tourLeaderPhone: dto.tourLeaderPhone ?? undefined,
    emergencyContactName: dto.emergencyContactName ?? undefined,
    emergencyContactPhone: dto.emergencyContactPhone ?? undefined,
    meetingPoint: dto.meetingPoint ?? undefined
  }
}

/** Finance close, final note and feedback come from the server; the other closure flags are still derived locally. */
function closureFrom (dto: ProjectInternalDto, local?: Project): Project['closureChecklist'] {
  if (!dto.financeSettledAt && !dto.finalNote && !dto.clientFeedback && !local?.closureChecklist) { return undefined }
  const base = local?.closureChecklist ?? { financeSettled: false, documentsArchived: false, feedbackCollected: false, assetsReturned: false, servicesCompleted: false, unresolvedIssuesHandled: false, documentsComplete: false }
  return { ...base, financeSettled: !!dto.financeSettledAt, finalNote: dto.finalNote ?? undefined, clientFeedback: dto.clientFeedback ?? undefined }
}

/** Updates (in place) or appends one server project. Portal DTOs carry no header fields and are ignored. */
export function upsertServerProject (dto: ProjectDto): Project | undefined {
  if (!isInternalProject(dto)) { return undefined }
  const local = PROJECTS.find(p => p.id === dto.id)
  if (local) {
    Object.assign(local, serverFields(dto, local))
    return local
  }
  const created = { budgetIdr: 0, actualCostIdr: 0, ...serverFields(dto) } as Project
  PROJECTS.push(created)
  return PROJECTS[PROJECTS.length - 1]
}

/** A project the user just created on the server: add it locally (its default milestones come from the server, S7c). */
export function registerNewServerProject (dto: ProjectDto): Project {
  const project = upsertServerProject(dto)
  if (!project) { throw new Error('Project baru harus berupa DTO internal.') }
  return project
}

/** The server created the project's standard milestones with it; a failed reload is fixed by the next sync. */
export async function loadNewProjectMilestones (api: Pick<ManovaApi, 'core'>, projectId: string): Promise<void> {
  try {
    await reloadProjectMilestones(api, projectId)
  } catch {
    // The work-items sync brings them on the next load.
  }
}

/** The full server list replaces the local one (internal DTOs only; a portal list leaves the array alone). */
export function mergeServerProjects (list: ProjectDto[]): void {
  const internal = list.filter(isInternalProject)
  if (!internal.length && list.length) { return }
  const keep = new Set(internal.map(p => p.id))
  for (let i = PROJECTS.length - 1; i >= 0; i--) {
    if (!keep.has(PROJECTS[i]!.id)) { PROJECTS.splice(i, 1) }
  }
  for (const dto of internal) { upsertServerProject(dto) }
}

/** Every page of `GET /projects`, merged only after the last page arrived (a failure leaves the array as is). */
export async function loadServerProjects (api: Pick<ManovaApi, 'core'>): Promise<number> {
  const all: ProjectDto[] = []
  let cursor: string | undefined
  for (let page = 0; page < 200; page++) {
    const res = await api.core.listProjects({ limit: 100, ...(cursor ? { cursor } : {}) })
    all.push(...res.data)
    const next = res.meta.pagination?.nextCursor ?? null
    if (!next) { break }
    cursor = next
  }
  mergeServerProjects(all)
  return all.length
}

export interface ProjectsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads the projects once per signed-in user; the dashboard layout calls it, "Reset Demo Data" forces it. */
export function useProjectsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<ProjectsSyncState>('manova-projects-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerProjects(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = {
        status: offline ? 'offline' : 'error',
        userId,
        message: isApiError(error) ? error.message : 'Daftar project belum bisa dimuat dari server.'
      }
    }
  }

  return { state, load }
}

function toServerInput (input: CreateProjectInput & { leadId?: string; sourceQuotationId?: string }) {
  return {
    name: input.name.trim(),
    ...(input.isGroupTrip ? { isGroupTrip: true } : { partyId: input.partyId }),
    destination: input.destination.trim(),
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    characteristic: input.characteristic ?? 'normal',
    serviceScope: input.serviceScope,
    travelerCount: input.travelerCount,
    contractValueMinor: String(Math.round(input.quotationAmountIdr)),
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.sourceQuotationId ? { sourceQuotationId: input.sourceQuotationId } : {})
  }
}

/** Creates the project on the server (one idempotency key per form fill), then adds it to `PROJECTS`. */
export async function createProjectOnServer (api: Pick<ManovaApi, 'core'>, input: CreateProjectInput, idempotencyKey: string = newIdempotencyKey()): Promise<Project> {
  const res = await api.core.createProject(toServerInput(input), idempotencyKey)
  const project = registerNewServerProject(res.data)
  project.budgetIdr = input.quotationAmountIdr
  await loadNewProjectMilestones(api, project.id)
  return project
}

/**
 * Edit the project header on the server (schedule, destination, field contacts …) and apply the answer to the
 * same object. Step gates read these fields: "Departure"/"On Progress" compare the travel dates with
 * `DEMO_REFERENCE_DATE`, and "Start" needs the field contacts (`project-order-workflow.ts`).
 */
export async function patchProjectOnServer (api: Pick<ManovaApi, 'core'>, projectId: string, input: ProjectPatchInput): Promise<Project> {
  const res = await api.core.updateProject(projectId, input)
  const project = upsertServerProject(res.data)
  if (!project) { throw new Error('Jawaban server tidak berisi data project.') }
  return project
}

/**
 * One step forward in the Project Order (S3b). Gates whose data is still local (travelers, itinerary,
 * incidents, bookings …) are checked here first and block without calling the server; the server then enforces
 * its own rules (transition map, handover, DP received before Ready, finance closed before Close). Server errors
 * are thrown for the page to show.
 */
export async function advanceProjectOrderOnServer (
  api: Pick<ManovaApi, 'core'>,
  projectId: string,
  options: AdvanceProjectOrderOptions = {},
  gateOf: (projectId: string, stepKey: ProjectOrderStepKey) => ProjectOrderGateResult = evaluateProjectOrderStepGate
): Promise<AdvanceProjectOrderResult> {
  const project = PROJECTS.find(p => p.id === projectId)
  if (!project) { return { success: false, blockers: ['Project Order tidak ditemukan.'] } }
  const stepKey = getProjectOrderStep(project)
  const step = getProjectOrderStepDef(stepKey)
  if (!step) { return { success: false, blockers: ['Step tidak dikenal.'] } }
  const gate = gateOf(projectId, stepKey)
  if (!gate.ready) { return { success: false, blockers: gate.blockers, stepKey } }

  if (step.sideEffect === 'closeProject') {
    const finalNote = options.finalNote?.trim()
    if (!finalNote) { return { success: false, blockers: ['Catatan akhir wajib diisi sebelum menutup Project Order.'], stepKey } }
    upsertServerProject((await api.core.closeProject(projectId, { finalNote, clientFeedback: options.clientFeedback?.trim() || undefined })).data)
    return { success: true, blockers: [], stepKey }
  }
  if (step.sideEffect === 'markReady') {
    upsertServerProject((await api.core.markProjectReady(projectId)).data)
    return { success: true, blockers: [], stepKey }
  }
  if (!step.targetStatus) { return { success: false, blockers: ['Step ini tidak punya aksi lanjut.'], stepKey } }
  // Drafting covers draft and planning; the server moves one status per call, so the chain runs here.
  const chain: ProjectStatus[] = project.status === 'draft' && step.targetStatus === 'confirmed' ? ['planning', step.targetStatus] : [step.targetStatus]
  for (const status of chain) {
    if (project.status === status) { continue }
    upsertServerProject((await api.core.transitionProject(projectId, status)).data)
  }
  return { success: true, blockers: [], stepKey }
}

/** Reloads one project from the server (after an error, or after Finance recorded a cancellation). */
export async function reloadProjectFromServer (api: Pick<ManovaApi, 'core'>, projectId: string): Promise<Project | undefined> {
  return upsertServerProject((await api.core.getProject(projectId)).data)
}

const applyProject = async (call: Promise<{ data: ProjectDto }>) => upsertServerProject((await call).data)

export const acceptHandoverOnServer = (api: Pick<ManovaApi, 'core'>, projectId: string) => applyProject(api.core.acceptHandover(projectId))
export const closeFinanceOnServer = (api: Pick<ManovaApi, 'core'>, projectId: string) => applyProject(api.core.closeProjectFinance(projectId))
export const addTeamMemberOnServer = (api: Pick<ManovaApi, 'core'>, projectId: string, userId: string) => applyProject(api.core.addProjectMember(projectId, userId))
export const removeTeamMemberOnServer = (api: Pick<ManovaApi, 'core'>, projectId: string, userId: string) => applyProject(api.core.removeProjectMember(projectId, userId))
