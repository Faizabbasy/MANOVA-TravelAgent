import type { Queryable } from '../../db/client'
import { ID_PATTERN } from '../../http/envelope'
import { errors } from '../../http/errors'

/** Retail sources use the real standalone order; project supplier costs remain at project level. */
export async function standaloneSupplierOrder(tx: Queryable, salesOrderId: string | undefined, projectId?: string | null) {
  if (!salesOrderId) return null
  if (!ID_PATTERN.test(salesOrderId)) throw errors.validation({salesOrderId:['Referensi order tidak valid.']})
  const [o]=await tx.query<{project_id:string|null}>('select project_id from sales_order_refs where id=$1 for update',[salesOrderId])
  if (!o || o.project_id || projectId) throw errors.validation({salesOrderId:['Pilih order B2C mandiri. Biaya Group Trip tetap dicatat pada project perjalanan.']})
  return salesOrderId
}

export async function assertOrderBillable(tx:Queryable,salesOrderId:string|null|undefined) {
  if (!salesOrderId) return
  const [o]=await tx.query<{status:string}>('select status from sales_order_refs where id=$1 for update',[salesOrderId])
  const [r]=await tx.query("select 1 from refunds where subject_type='sales_order' and subject_id=$1 and status<>'rejected'",[salesOrderId])
  if (!o || o.status==='cancelled' || r) throw errors.validation({salesOrderId:['Order dibatalkan atau memiliki kasus pembatalan aktif. Tinjau kasus sumber sebelum membuat tagihan/pengakuan baru.']})
}
