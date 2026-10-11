import { DOCUMENT_RECORDS, MESSAGE_RECORDS } from './document-comms'
import { refreshProjectActivities } from './activity-sync'
import type { Document, Message } from '~/types/document-comms'
import type { DocumentDto, DocumentInput, MessageDto, MessageInput } from '~/types/api'
import type { ManovaApi } from '~/lib/api/endpoints'
import { newIdempotencyKey } from '~/lib/api/client'
import { isApiError } from '~/lib/api/errors'

/**
 * Server → `DOCUMENT_RECORDS`, `MESSAGE_RECORDS` (S9). The server owns document metadata and internal messages; the
 * hidden client portal still writes its own rows locally (`DOC-L…`, `MSG-L…`), which a merge keeps. The server
 * notifies mentioned users (S9b).
 */

type CoreApi = Pick<ManovaApi, 'core'>
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v)
const isLocal = (prefix: string) => (id: string) => id.startsWith(prefix)

export function documentFromServer (d: DocumentDto): Document {
  return {
    id: d.id,
    entityType: d.entityType,
    entityId: d.entityId,
    projectId: opt(d.projectId),
    name: d.name,
    category: d.category,
    version: d.version,
    uploadedAt: opt(d.uploadedAt),
    generatedAt: opt(d.generatedAt),
    expiresAt: opt(d.expiresAt),
    accessLevel: d.accessLevel,
    sourceType: d.sourceType,
    previewRoute: opt(d.previewRoute),
    uploadedBy: opt(d.uploadedBy),
    supersedesId: opt(d.supersedesId),
    verified: d.verified,
    verifiedBy: opt(d.verifiedBy),
    verifiedAt: opt(d.verifiedAt)
  }
}

export function messageFromServer (d: MessageDto): Message {
  return {
    id: d.id,
    entityType: d.entityType,
    entityId: d.entityId,
    projectId: opt(d.projectId),
    channel: d.channel,
    senderId: d.senderId,
    body: d.body,
    mentions: [...d.mentions],
    sentAt: d.sentAt,
    deliveryStatus: d.deliveryStatus,
    deliveryChannel: opt(d.deliveryChannel),
    attachmentName: opt(d.attachmentName),
    readBy: [...d.readBy]
  }
}

function upsert<T extends { id: string }> (list: T[], value: T): T {
  const local = list.find(x => x.id === value.id)
  if (!local) {
    list.push(value)
    return list[list.length - 1]!
  }
  Object.assign(local, value)
  return local
}

function replaceAll<T extends { id: string }> (list: T[], values: T[], keepLocal: (id: string) => boolean) {
  const keep = new Set(values.map(v => v.id))
  for (let i = list.length - 1; i >= 0; i--) {
    const id = list[i]!.id
    if (!keep.has(id) && !keepLocal(id)) { list.splice(i, 1) }
  }
  for (const v of values) { upsert(list, v) }
}

export function mergeServerDocuments (documents: DocumentDto[], messages: MessageDto[]): void {
  replaceAll(DOCUMENT_RECORDS, documents.map(documentFromServer), isLocal('DOC-L'))
  replaceAll(MESSAGE_RECORDS, messages.map(messageFromServer), isLocal('MSG-L'))
}

export async function loadServerDocuments (api: CoreApi): Promise<void> {
  const [documents, messages] = await Promise.all([api.core.listDocuments(), api.core.listMessages()])
  mergeServerDocuments(documents.data, messages.data)
}

export async function createDocumentOnServer (api: CoreApi, input: DocumentInput, key: string = newIdempotencyKey()): Promise<Document> {
  return upsert(DOCUMENT_RECORDS, documentFromServer((await api.core.createDocument(input, key)).data))
}

export async function sendMessageOnServer (api: CoreApi, input: MessageInput, key: string = newIdempotencyKey()): Promise<Message> {
  const message = upsert(MESSAGE_RECORDS, messageFromServer((await api.core.sendMessage(input, key)).data))
  // A message to a client / supplier is written to the project log by the server.
  if (message.projectId && message.channel !== 'internal-note') { await refreshProjectActivities(api, message.projectId) }
  return message
}

export interface DocumentsSyncState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error'
  userId: string | null
  message: string | null
}

/** Loads documents and messages once per signed-in user (dashboard layout, "Reset Demo Data"). */
export function useDocumentsSync () {
  const api = useApi()
  const session = useServerSession()
  const { currentUser } = useCurrentUser()
  const state = useState<DocumentsSyncState>('manova-documents-sync', () => ({ status: 'idle', userId: null, message: null }))

  async function load (force = false) {
    const userId = currentUser.value.id
    if (!force && state.value.userId === userId && (state.value.status === 'ready' || state.value.status === 'loading')) { return }
    state.value = { status: 'loading', userId, message: null }
    try {
      await session.ensure()
      await loadServerDocuments(api)
      state.value = { status: 'ready', userId, message: null }
    } catch (error) {
      const offline = isApiError(error) && (error.status === 0 || error.status >= 500)
      state.value = { status: offline ? 'offline' : 'error', userId, message: isApiError(error) ? error.message : 'Dokumen & pesan belum bisa dimuat dari server.' }
    }
  }

  return { state, load }
}
