import { Elysia,t } from 'elysia'
import type { AppDeps } from '../../app-deps'
import type { AuthContext } from '../../auth/context'
import { assertIdParam,ok,okList,requestIdOf } from '../../http/envelope'
import { requireIdempotencyKey,withIdempotency } from '../../shared/idempotency'
import { createBook,createDraftPolicy,createPeriod,lockRehearsalPeriod,reopenRehearsalPeriod } from './setup'
import { journalDetail,listExceptions,listJournals,setupStatus,sourceStatus,trialBalance } from './reads'
import { balanceSheet,profitAndLoss,projectContribution } from './reports'
import { closePeriod,periodReview } from './review'
import { retryPendingEvent } from './retry'
import { confirmOpening,openingPreview,type OpeningDecisions } from './opening'
import { projectAccountingSummary } from './project-summary'
import { orderAccountingSummary } from './order-summary'
import {rehearseDraftPolicy} from './policy-rehearsal'

export function accountingRoutes(deps:AppDeps,auth:AuthContext) {
  const { db } = deps
  const text = t.String({ maxLength:500 })
  return new Elysia({ prefix:'/api/v1/accounting' })
    .get('/orders/:id/summary',async ({request,params})=>{
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await orderAccountingSummary(db,assertIdParam(params.id,'Order')))
    })
    .get('/setup',async ({ request }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await db.transaction(setupStatus))
    })
    .post('/setup',async ({ request,body }) => {
      const actor = await auth.requireCapability(request,'accounting.manage-setup')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:'POST /accounting/setup',key:requireIdempotencyKey(request),body },tx => createBook(tx,actor,body,requestIdOf(request),deps.config.appEnv))
      return ok(request,result.data)
    },{ body:t.Object({ name:text,purpose:text,cutoverDate:text,timezone:text,entityType:t.Optional(text),accountingStandard:t.Optional(text) },{ additionalProperties:false }) })
    .post('/periods',async ({ request,body }) => {
      const actor = await auth.requireCapability(request,'accounting.manage-setup')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:'POST /accounting/periods',key:requireIdempotencyKey(request),body },tx => createPeriod(tx,actor,body,requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ startsOn:text,endsOn:text,reason:text },{ additionalProperties:false }) })
    .post('/policies',async ({ request,body }) => {
      const actor = await auth.requireCapability(request,'accounting.manage-setup')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:'POST /accounting/policies',key:requireIdempotencyKey(request),body },tx => createDraftPolicy(tx,actor,body,requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ sourceKind:text,effectiveFrom:text,principalAgent:text,recognition:text,taxTreatment:text,rationale:text,
      settings:t.Optional(t.Object({costMatching:t.Optional(text),invoiceTreatment:t.Optional(text),billingRight:t.Optional(text),method:t.Optional(text),
        classifications:t.Optional(t.Record(t.String({maxLength:30}),text)),contributionRole:t.Optional(text),withdrawalRole:t.Optional(text),deductionRole:t.Optional(text)},{additionalProperties:false})) },{ additionalProperties:false }) })
    .post('/policies/:id/rehearse',async({request,params,body,set})=>{
      const actor=await auth.requireCapability(request,'accounting.manage-setup'),id=assertIdParam(params.id,'Usulan kebijakan')
      const r=await withIdempotency(db,{actorUserId:actor.userId,route:`POST /accounting/policies/${id}/rehearse`,key:requireIdempotencyKey(request),body},tx=>rehearseDraftPolicy(tx,actor,id,body,requestIdOf(request),deps.config.appEnv))
      if(r.replayed)set.headers['idempotent-replayed']='true'
      return ok(request,r.data)
    },{body:t.Object({reason:text,confirm:t.Boolean()},{additionalProperties:false})})
    .post('/periods/:id/lock-rehearsal',async ({ request,params,body }) => {
      const actor = await auth.requireCapability(request,'accounting.close-period')
      const id = assertIdParam(params.id,'Periode')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:`POST /accounting/periods/${id}/lock-rehearsal`,key:requireIdempotencyKey(request),body },tx => lockRehearsalPeriod(tx,actor,id,body.version,body.reason,requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ version:t.Integer({ minimum:1 }),reason:text },{ additionalProperties:false }) })
    .get('/periods/:id/review',async ({ request,params }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await db.transaction(tx => periodReview(tx,assertIdParam(params.id,'Periode'))))
    })
    .post('/periods/:id/close',async ({ request,params,body }) => {
      const actor = await auth.requireCapability(request,'accounting.close-period')
      const id = assertIdParam(params.id,'Periode')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:`POST /accounting/periods/${id}/close`,key:requireIdempotencyKey(request),body },tx => closePeriod(tx,actor,id,body,requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ version:t.Integer({ minimum:1 }),reason:text,confirm:t.Boolean() },{ additionalProperties:false }) })
    .post('/periods/:id/reopen-rehearsal',async ({ request,params,body }) => {
      const actor = await auth.requireCapability(request,'accounting.reopen-period')
      const id = assertIdParam(params.id,'Periode')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:`POST /accounting/periods/${id}/reopen-rehearsal`,key:requireIdempotencyKey(request),body },tx => reopenRehearsalPeriod(tx,actor,id,body.version,body.reason,requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ version:t.Integer({ minimum:1 }),reason:text },{ additionalProperties:false }) })
    .get('/trial-balance',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await trialBalance(db,query.asOf))
    },{ query:t.Object({ asOf:text }) })
    .get('/reports/profit-loss',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await profitAndLoss(db,query))
    },{ query:t.Object({ from:text,to:text }) })
    .get('/reports/balance-sheet',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await balanceSheet(db,query))
    },{ query:t.Object({ asOf:text }) })
    .get('/reports/project-contribution',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await projectContribution(db,query))
    },{ query:t.Object({ from:text,to:text }) })
    .get('/journals',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-posting-detail')
      const page = await listJournals(db,query)
      return okList(request,page.items,page.pagination)
    },{ query:t.Object({ limit:t.Optional(text),cursor:t.Optional(text),sourceType:t.Optional(text),sourceId:t.Optional(text),projectId:t.Optional(text) }) })
    .get('/journals/:id',async ({ request,params }) => {
      await auth.requireCapability(request,'accounting.view-posting-detail')
      return ok(request,await journalDetail(db,assertIdParam(params.id,'Jurnal')))
    })
    .get('/sources/:type/:id',async ({ request,params }) => {
      await auth.requireCapability(request,'accounting.view-posting-detail')
      return ok(request,await sourceStatus(db,params.type,assertIdParam(params.id,'Sumber')))
    })
    .post('/exceptions/:eventId/retry',async ({ request,params }) => {
      const actor = await auth.requireCapability(request,'accounting.manage-setup')
      const id = assertIdParam(params.eventId,'Pekerjaan accounting')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:`POST /accounting/exceptions/${id}/retry`,key:requireIdempotencyKey(request),body:{} },tx => retryPendingEvent(tx,actor,id,requestIdOf(request)))
      return ok(request,result.data)
    })
    .get('/projects/:id/summary',async ({ request,params }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await projectAccountingSummary(db,assertIdParam(params.id,'Project')))
    })
    .get('/opening-plan',async ({ request }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      return ok(request,await db.transaction(tx => openingPreview(tx)))
    })
    .post('/opening-plan/preview',async ({ request,body }) => {
      await auth.requireCapability(request,'accounting.manage-setup')
      return ok(request,await db.transaction(tx => openingPreview(tx,body.decisions as OpeningDecisions)))
    },{ body:t.Object({ decisions:t.Record(t.String(),t.Any()) },{ additionalProperties:false }) })
    .post('/opening-plan/confirm',async ({ request,body }) => {
      const actor = await auth.requireCapability(request,'accounting.manage-setup')
      const result = await withIdempotency(db,{ actorUserId:actor.userId,route:'POST /accounting/opening-plan/confirm',key:requireIdempotencyKey(request),body },
        tx => confirmOpening(tx,actor,{ planHash:body.planHash,decisions:body.decisions as OpeningDecisions,reason:body.reason },requestIdOf(request)))
      return ok(request,result.data)
    },{ body:t.Object({ planHash:t.String({ maxLength:64 }),decisions:t.Record(t.String(),t.Any()),reason:text },{ additionalProperties:false }) })
    .get('/exceptions',async ({ request,query }) => {
      await auth.requireCapability(request,'accounting.view-business-finance')
      const page = await listExceptions(db,query)
      return okList(request,page.items,page.pagination)
    },{ query:t.Object({ limit:t.Optional(text),cursor:t.Optional(text) }) })
}
