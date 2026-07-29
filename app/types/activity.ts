import type { ID } from './common'

export interface ActivityEntry {
  id: ID
  projectId: ID
  message: string
  isChange: boolean
  reviewed: boolean
  createdAt: string
}

export interface ProjectDocument {
  id: ID
  projectId: ID
  name: string
  uploadedAt: string
}

export interface ProjectTask {
  id: ID
  projectId: ID
  title: string
  status: 'not-started' | 'in-progress' | 'pending-confirmation' | 'done' | 'overdue'
  dueAt?: string
}
