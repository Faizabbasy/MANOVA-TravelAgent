import {Elysia,t} from 'elysia'
import type {AppDeps} from '../../app-deps'
import type {AuthContext} from '../../auth/context'
import {assertIdParam,ok,requestIdOf} from '../../http/envelope'
import {requireIdempotencyKey,withIdempotency} from '../../shared/idempotency'
import {changeBillingStatus,createChangeBillingPlan,voidChangeBillingPlan} from './change-billing'
const text=t.String({maxLength:500})
export function changeBillingRoutes({db}:AppDeps,auth:AuthContext) {
  return new Elysia({prefix:'/api/v1/finance'})
    .get('/change-requests/:id/billing',async({request,params})=>{
      await auth.requireCapability(request,'finance.view-cash')
      return ok(request,await db.transaction(tx=>changeBillingStatus(tx,assertIdParam(params.id,'Change request'))))
    })
    .post('/change-requests/:id/billing',async({request,params,body,set})=>{
      const actor=await auth.requireCapability(request,'finance.manage-receivables'),id=assertIdParam(params.id,'Change request')
      const r=await withIdempotency(db,{actorUserId:actor.userId,route:`POST /finance/change-requests/${id}/billing`,key:requireIdempotencyKey(request),body},tx=>createChangeBillingPlan(tx,actor,id,body,requestIdOf(request)))
      if(r.replayed) set.headers['idempotent-replayed']='true'
      set.status=201;return ok(request,r.data)
    },{body:t.Object({mode:text,basis:text,reason:text,allocations:t.Array(t.Object({salesOrderId:t.Optional(text),amountMinor:text,dueDate:text},{additionalProperties:false}),{maxItems:100})},{additionalProperties:false})})
    .post('/change-billing-plans/:id/void',async({request,params,body,set})=>{
      const actor=await auth.requireCapability(request,'finance.manage-receivables'),id=assertIdParam(params.id,'Rencana penagihan')
      const r=await withIdempotency(db,{actorUserId:actor.userId,route:`POST /finance/change-billing-plans/${id}/void`,key:requireIdempotencyKey(request),body},tx=>voidChangeBillingPlan(tx,actor,id,body.reason,requestIdOf(request)))
      if(r.replayed) set.headers['idempotent-replayed']='true'
      return ok(request,r.data)
    },{body:t.Object({reason:text},{additionalProperties:false})})
}
