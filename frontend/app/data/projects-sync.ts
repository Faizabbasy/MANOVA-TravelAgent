import { PROJECTS } from './projects'
import { resolveDestinationGeo } from './geo'
import { seedDefaultProjectMilestones } from './index'
import type { Project } from '~/types/project'
import { isInternalProject, type ProjectDto, type ProjectInternalDto } from '~/types/api'

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
    teamUserIds: dto.teamUserIds.length ? [...dto.teamUserIds] : local?.teamUserIds ?? [],
    status: dto.status,
    quotationAmountIdr: dto.contractValueMinor !== null ? Number(dto.contractValueMinor) : local?.quotationAmountIdr ?? 0,
    tourLeaderName: dto.tourLeaderName ?? undefined,
    tourLeaderPhone: dto.tourLeaderPhone ?? undefined,
    emergencyContactName: dto.emergencyContactName ?? undefined,
    emergencyContactPhone: dto.emergencyContactPhone ?? undefined,
    meetingPoint: dto.meetingPoint ?? undefined
  }
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

/** A project the user just created on the server: add it and give it the standard local milestones. */
export function registerNewServerProject (dto: ProjectDto): Project {
  const project = upsertServerProject(dto)
  if (!project) { throw new Error('Project baru harus berupa DTO internal.') }
  seedDefaultProjectMilestones(project)
  return project
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
