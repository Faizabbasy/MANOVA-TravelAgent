import type { ManovaApi } from '~/lib/api/endpoints'
import type { AttachmentDto, CollabEntityType, CommentDto } from '~/types/api'

/**
 * S12c-5: comments and attachment names on client-facing records. The client portal and staff screens share one UI;
 * `portal` picks the `/client/*` routes (own party only, staff ids hidden) or the staff routes.
 */
export function collabApi (api: Pick<ManovaApi, 'core'>, portal: boolean) {
  const core = api.core
  return {
    comments: async (entityType: CollabEntityType, entityId: string): Promise<CommentDto[]> =>
      (await (portal ? core.listClientComments(entityType, entityId) : core.listComments(entityType, entityId))).data,
    addComment: async (entityType: CollabEntityType, entityId: string, body: string): Promise<CommentDto[]> =>
      (await (portal ? core.clientAddComment({ entityType, entityId, body }) : core.addComment({ entityType, entityId, body }))).data,
    attachments: async (entityType: CollabEntityType, entityId: string): Promise<AttachmentDto[]> =>
      (await (portal ? core.listClientAttachments(entityType, entityId) : core.listAttachments(entityType, entityId))).data,
    addAttachment: async (entityType: CollabEntityType, entityId: string, fileName: string): Promise<AttachmentDto[]> =>
      (await (portal ? core.clientAddAttachment({ entityType, entityId, fileName }) : core.addAttachment({ entityType, entityId, fileName }))).data
  }
}

/** In the portal MANOVA's people are marked; on staff screens the client is. */
export const commentAuthor = (c: Pick<CommentDto, 'authorName' | 'fromClient'>, portal: boolean) =>
  portal ? (c.fromClient ? c.authorName : `${c.authorName} (MANOVA)`) : (c.fromClient ? `${c.authorName} (client)` : c.authorName)
