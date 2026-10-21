import { Elysia, t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext, SessionActor } from '../../auth/context'
import { assertIdParam, ok, requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey, withIdempotency } from '../../shared/idempotency'
import { companyExpenseWorkspace, createExpenseSchedule, matchCompanyInvoice, recordCompanyExpense, stopExpenseSchedule, voidCompanyExpense } from './company-expenses'
const text=t.String({maxLength:200})
export function companyExpenseRoutes({db}:AppDeps,auth:AuthContext) {
  async function command<T>(request:Request,set:{headers:Record<string,string|number>},actor:SessionActor,route:string,body:unknown,run:Parameters<typeof withIdempotency<T>>[2]) {
    const r=await withIdempotency<T>(db,{actorUserId:actor.userId,route,key:requireIdempotencyKey(request),body},run)
    if (r.replayed) set.headers['idempotent-replayed']='true'
    return ok(request,r.data)
  }
  return new Elysia({prefix:'/api/v1/finance'})
    .get('/company-expenses',async({request,query})=>{await auth.requireCapability(request,'finance.view-cash');return ok(request,await db.transaction(tx=>companyExpenseWorkspace(tx,query)))},
      {query:t.Object({cursor:t.Optional(text),limit:t.Optional(text)})})
    .post('/company-expense-schedules',async({request,body,set})=>{const a=await auth.requireCapability(request,'finance.manage-payables');set.status=201;return command(request,set,a,'POST /finance/company-expense-schedules',body,tx=>createExpenseSchedule(tx,a,body,requestIdOf(request)))},
      {body:t.Object({vendorId:text,description:text,contractRef:text,category:text,amountMinor:text,startMonth:text,months:t.Integer(),dueDay:t.Integer()},{additionalProperties:false})})
    .post('/company-expense-schedules/:id/stop',async({request,params,body,set})=>{const a=await auth.requireCapability(request,'finance.manage-payables'),id=assertIdParam(params.id,'Jadwal biaya');return command(request,set,a,`POST /finance/company-expense-schedules/${id}/stop`,body,tx=>stopExpenseSchedule(tx,a,id,body,requestIdOf(request)))},
      {body:t.Object({fromMonth:text,reason:text},{additionalProperties:false})})
    .post('/company-expenses',async({request,body,set})=>{const a=await auth.requireCapability(request,'finance.manage-payables');set.status=201;return command(request,set,a,'POST /finance/company-expenses',body,tx=>recordCompanyExpense(tx,a,body,requestIdOf(request)))},
      {body:t.Object({scheduleId:t.Optional(text),period:t.Optional(text),vendorId:t.Optional(text),category:t.Optional(text),description:t.Optional(text),amountMinor:t.Optional(text),
        incurredOn:text,dueDate:t.Optional(text),evidenceRef:text,basis:text},{additionalProperties:false})})
    .post('/company-expenses/:id/invoice',async({request,params,body,set})=>{const a=await auth.requireCapability(request,'finance.manage-payables'),id=assertIdParam(params.id,'Biaya kantor');return command(request,set,a,`POST /finance/company-expenses/${id}/invoice`,body,tx=>matchCompanyInvoice(tx,a,id,body.vendorInvoiceId,requestIdOf(request)))},
      {body:t.Object({vendorInvoiceId:text},{additionalProperties:false})})
    .post('/company-expenses/:id/void',async({request,params,body,set})=>{const a=await auth.requireCapability(request,'finance.manage-payables'),id=assertIdParam(params.id,'Biaya kantor');return command(request,set,a,`POST /finance/company-expenses/${id}/void`,body,tx=>voidCompanyExpense(tx,a,id,body.reason,requestIdOf(request)))},
      {body:t.Object({reason:text},{additionalProperties:false})})
}
