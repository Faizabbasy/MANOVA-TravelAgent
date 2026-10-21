import {Elysia,t} from 'elysia'
import type {AppDeps} from '../../app-deps'
import type {AuthContext} from '../../auth/context'
import {assertIdParam,ok,requestIdOf} from '../../http/envelope'
import {requireIdempotencyKey,withIdempotency} from '../../shared/idempotency'
import {matchSupplierReceipt,supplierMatchWorkspace,voidSupplierMatch} from './supplier-matching'
export function supplierMatchingRoutes({db}:AppDeps,auth:AuthContext){
  const text=t.String({maxLength:500})
  return new Elysia({prefix:'/api/v1/finance'})
    .get('/vendor-invoices/:id/receipts',async({request,params})=>{
      await auth.requireCapability(request,'finance.view-project-finance')
      return ok(request,await db.transaction(tx=>supplierMatchWorkspace(tx,assertIdParam(params.id,'Invoice supplier'))))
    })
    .post('/vendor-invoices/:id/receipts',async({request,params,body,set})=>{
      const actor=await auth.requireCapability(request,'finance.manage-payables'),id=assertIdParam(params.id,'Invoice supplier')
      const result=await withIdempotency(db,{actorUserId:actor.userId,route:`POST /finance/vendor-invoices/${id}/receipts`,key:requireIdempotencyKey(request),body},tx=>matchSupplierReceipt(tx,actor,id,body,requestIdOf(request)))
      if(result.replayed)set.headers['idempotent-replayed']='true'
      set.status=201
      return ok(request,result.data)
    },{body:t.Object({fulfillmentId:text,actualMinor:t.String({maxLength:20}),closesReceipt:t.Boolean(),postingDate:t.Optional(text),reason:text},{additionalProperties:false})})
    .post('/supplier-receipt-matches/:id/void',async({request,params,body,set})=>{
      const actor=await auth.requireCapability(request,'finance.manage-payables'),id=assertIdParam(params.id,'Pencocokan supplier')
      const result=await withIdempotency(db,{actorUserId:actor.userId,route:`POST /finance/supplier-receipt-matches/${id}/void`,key:requireIdempotencyKey(request),body},tx=>voidSupplierMatch(tx,actor,id,body.reason,requestIdOf(request)))
      if(result.replayed)set.headers['idempotent-replayed']='true'
      return ok(request,result.data)
    },{body:t.Object({reason:text},{additionalProperties:false})})
}
