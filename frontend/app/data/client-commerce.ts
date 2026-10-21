import { reactive } from 'vue'
import type { ClientReservationDto } from '~/types/api'

/**
 * Client portal reservations from the server (S12a-2). Kept apart from the internal booking arrays: the client view
 * carries no money, vendor or internal note, and must never overwrite the internal booking objects. `loaded` tells
 * the portal helpers to read this instead of deriving reservations from the local booking fixtures.
 */
export const CLIENT_RESERVATIONS: ClientReservationDto[] = reactive<ClientReservationDto[]>([])
export const CLIENT_COMMERCE_STATE = reactive({ reservationsLoaded: false })
