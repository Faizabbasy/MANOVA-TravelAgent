import type {Queryable} from '../../db/client'
import {errors} from '../../http/errors'
import {EXPENSE_CATEGORIES} from '../finance/common'
export interface PolicySettingsInput {
  costMatching?:string;invoiceTreatment?:string;billingRight?:string;method?:string
  classifications?:Record<string,string>;contributionRole?:string;withdrawalRole?:string;deductionRole?:string
}
export async function validatePolicySettings(tx:Queryable,bookId:string,source:string,settings:PolicySettingsInput){
  const invalid=()=>errors.validation({settings:['Pilih pengaturan yang didukung untuk jenis sumber ini. Pengaturan yang belum diputuskan tetap kosong/unknown.']})
  const scalar:Record<string,string[]>={
    ...(['vendor_billing','supplier_fulfillment'].includes(source)?{costMatching:['unknown','receipt-links']}:{}),
    ...(source==='vendor_billing'?{invoiceTreatment:['unknown','prepaid']}:{}),
    ...(source==='customer_billing'?{billingRight:['unknown','unconditional']}:{}),
    ...(source==='prepaid_opex'?{method:['unknown','equal-months']}:{}),
    ...(source==='asset'?{method:['unknown','straight-line']}:{}),
    ...(source==='owner_funds'?{contributionRole:['unknown','capital','owner-funds','loan'],withdrawalRole:['unknown','capital','owner-funds','loan']}:{}),
    ...(source==='payroll'?{deductionRole:['unknown','tax-payable']}: {})
  }
  for(const [key,value] of Object.entries(settings)){
    if(key==='classifications'){
      if(!['manual_cash','company_expense','employee_advance'].includes(source) || !value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length>24)throw invalid()
      for(const [category,role] of Object.entries(value as Record<string,string>)){
        const categories=source==='company_expense'?['office','utilities','marketing','other']
          :[...EXPENSE_CATEGORIES.filter(c=>!['payroll','tax'].includes(c)),...(source==='manual_cash'?['other_income']:['trip','utilities'])]
        const roles=source==='company_expense'?['office-expense']:category==='other_income'?['other-revenue']:['office-expense','direct-cost','bank-fee']
        if(!categories.includes(category) || !roles.includes(role))throw invalid()
        if(!(await tx.query('select 1 from accounting_accounts where book_id=$1 and control_role=$2',[bookId,role])).length)throw invalid()
      }
    }else if(typeof value!=='string' || !scalar[key]?.includes(value))throw invalid()
  }
}
