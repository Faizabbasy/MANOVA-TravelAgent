import type { ID } from './common'
import type { ServiceTypeKey } from './project'

export interface Vendor {
  id: ID
  name: string
  serviceType: ServiceTypeKey
  contactName: string
  contactPhone?: string
}
