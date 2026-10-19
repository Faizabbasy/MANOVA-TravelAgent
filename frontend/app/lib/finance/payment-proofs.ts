/**
 * S12c-1: a client's proof of payment, verified by Finance by posting the receipt it describes. The proof only
 * prefills the form — the amount and date Finance enters are the official ones.
 */
export function proofVerifyDefaults (proof: { amountMinor: string; transferDate: string; reference: string }, today: string) {
  return { amount: proof.amountMinor, date: proof.transferDate > today ? today : proof.transferDate, reference: proof.reference }
}
