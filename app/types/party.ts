import type { ID } from './common'

export type PartyLifecycleStatus = 'prospect' | 'client'

export interface Party {
  id: ID
  name: string
  lifecycleStatus: PartyLifecycleStatus
  industry?: string
  createdAt: string
}

export interface ContactPerson {
  id: ID
  partyId: ID
  name: string
  title: string
  email?: string
  phone?: string
}
