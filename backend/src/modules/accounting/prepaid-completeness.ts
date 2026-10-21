import type { Queryable } from '../../db/client'

/** One definition of a missing completed service month for reports, closing and the opening plan. */
export async function missingPrepaidMonths(tx: Queryable, asOf: string) {
  return tx.query<{ id: string; description: string; missing: string }>(`select p.id,p.description,
    (select count(*) from generate_series(0,p.months-1) n where
      (p.starts_on+(n || ' months')::interval+interval '1 month - 1 day')::date <= $1
      and not exists(select 1 from prepaid_expense_amortizations a where a.prepaid_expense_id=p.id
        and a.period=to_char(p.starts_on+(n || ' months')::interval,'YYYY-MM'))) as missing
    from prepaid_expenses p join financial_transactions t on t.id=p.transaction_id
    where t.effective_date <= $1 and not exists(select 1 from financial_transactions r where r.reversal_of_id=t.id and r.effective_date <= $1)
    order by p.id`, [asOf]).then(rows => rows.filter(r => BigInt(r.missing) > 0n))
}
