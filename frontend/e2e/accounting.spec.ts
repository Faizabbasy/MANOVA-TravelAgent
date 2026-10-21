import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
const businessDate = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(k => p.find(v => v.type === k)!.value).join('-')
}

for (const role of ['Finance', 'Super Admin']) {
  test(`finance menus render after navigation and reload for ${role}`, async ({ page, request }, info) => {
    const health = await (await request.get('/api/v1/health')).json()
    expect(health.data.environment).toBe('test')
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: new RegExp(`Masuk sebagai .*${role}`, 'i') }).click()
    await expect(page).toHaveURL(/localhost:8080\/$/)
    await page.getByRole('button', { name: 'Submenu Finance & ACC', exact: true }).click()
    for (const entry of [
      { name: 'Aset, Pinjaman & Modal', path: '/finance/funding', api: '/finance/funding', actions: ['Beli aset', 'Catat pinjaman'] },
      { name: 'Kasbon & Bukti Biaya', path: '/finance/staff-funds', api: '/finance/staff-funds', actions: ['Beri uang jalan', 'Catat bukti pengeluaran'] },
      { name: 'Laporan & Cek Bulanan', path: '/finance/accounting', api: '/accounting/setup', actions: [] }
    ]) {
      await page.getByRole('link', { name: entry.name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${entry.path}$`))
      await expect(page.getByRole('heading', { name: entry.name, exact: true })).toBeVisible()
      const response = await page.request.get(`/api/v1${entry.api}`)
      expect(response.ok(), await response.text()).toBe(true)
      for (const action of entry.actions) {
        const lookup = action === 'Beli aset' ? '/assets' : entry.path === '/finance/staff-funds' ? '/employees' : null
        const lookupResponse = lookup ? page.waitForResponse(r => new URL(r.url()).pathname === `/api/v1${lookup}` && r.request().method() === 'GET') : null
        await page.getByRole('button', { name: action, exact: true }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        if (lookupResponse) {
          const loaded = await lookupResponse
          expect(loaded.ok(), await loaded.text()).toBe(true)
          const items = (await loaded.json()).data
          const first = items.find((item: { status?: string }) => lookup === '/assets' || item.status !== 'resigned')
          expect(first).toBeTruthy()
          const select = page.locator(lookup === '/assets' ? '#fd-asset' : '#sa-employee')
          await select.click()
          await page.getByRole('option').filter({ hasText: first.name }).first().click()
          await expect(select).toContainText(first.name)
          await expect(page.locator('[role="listbox"]')).toHaveCount(0)
        }
        if (lookupResponse) {
          await page.getByRole('dialog').getByRole('button', { name: 'Batal', exact: true }).click()
        } else {
          await page.keyboard.press('Escape')
        }
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: entry.name, exact: true })).toBeVisible()
      await page.screenshot({ path: info.outputPath(`${entry.path.split('/').pop()}-1440.png`), fullPage: true })
    }
    expect(errors).toEqual([])
  })
}

test('owner resolves pending corrections by proposing and testing a policy through the real UI', async ({ page, request }, info) => {
  const health = await (await request.get('/api/v1/health')).json(); expect(health.data.environment).toBe('test'); expect(health.data.database.engine).toBe('pglite')
  const errors:string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', r => ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort())
  await page.goto('/login'); await page.getByRole('button', { name: /Masuk sebagai .*Super Admin/i }).click(); await expect(page).toHaveURL(/localhost:8080\/$/)
  const post = async (path:string, data:unknown) => { const r = await page.request.post(`/api/v1${path}`, { data, headers: { 'idempotency-key': crypto.randomUUID(), origin: 'http://localhost:8080' } }); expect(r.ok(), await r.text()).toBe(true); return (await r.json()).data }
  const bank = async () => (await (await page.request.get('/api/v1/finance/accounts/BA-UAT')).json()).data.balance.currentMinor
  const before = await bank()
  const i = await post('/finance/customer-invoices', { projectId: 'PRJ-101', invoiceType: 'dp', dueDate: '2026-12-01', lines: [{ description: 'TEST_ONLY browser pending correction', amountMinor: '10000000' }] })
  await post(`/finance/customer-invoices/${i.id}/issue`, { issueDate: '2026-09-05' }); await post(`/finance/customer-invoices/${i.id}/void`, { reason: 'TEST_ONLY browser corrected source' })
  const pending = (await (await page.request.get('/api/v1/accounting/exceptions')).json()).data.filter((e:{sourceId:string}) => e.sourceId === i.id)
  expect(pending).toHaveLength(2)
  const primary = pending.find((e:{effectiveDate:string}) => e.effectiveDate === '2026-09-05'); expect(primary).toBeTruthy()
  await page.goto('/finance/accounting'); await page.getByText('Pengaturan periode dan usulan kebijakan', { exact: true }).click()
  const proposal = page.getByRole('form', { name: 'Usulan kebijakan accounting' })
  await expect(proposal.locator('[name="principalAgent"]')).toHaveValue('unknown')
  for (const [name, value] of Object.entries({ effectiveFrom: '2026-09-01', principalAgent: 'principal', recognition: 'fulfillment', taxTreatment: 'TEST_ONLY_EXCLUDED', billingRight: 'unconditional', rationale: 'TEST_ONLY browser explicit contract fixture' })) { if (name === 'effectiveFrom' || name === 'rationale') { await proposal.locator(`[name="${name}"]`).fill(value) } else { await proposal.locator(`[name="${name}"]`).selectOption(value) } }
  const drafted = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/accounting/policies')
  await proposal.getByRole('button', { name: 'Simpan usulan kebijakan' }).click()
  const draft = (await (await drafted).json()).data; expect(draft.validationStatus).toBe('draft')
  await page.locator(`[data-policy-id="${draft.id}"]`).getByRole('button', { name: 'Uji di rehearsal' }).click()
  const dialog = page.getByRole('dialog', { name: 'Uji usulan pada data fiktif' }); const form = dialog.getByRole('form', { name: 'Uji kebijakan rehearsal' })
  await form.locator('[name="reason"]').fill('TEST_ONLY browser fixture confirmed')
  await expect(form.getByRole('button', { name: 'Uji di rehearsal' })).toBeDisabled(); await form.locator('[name="confirm"]').check()
  const tested = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/v1/accounting/policies/${draft.id}/rehearse`)
  await form.getByRole('button', { name: 'Uji di rehearsal' }).click()
  const result = (await (await tested).json()).data; expect(result.validationStatus).toBe('test-only'); await expect(dialog).toHaveCount(0)
  await page.locator(`[data-event-id="${primary.eventId}"]`).getByRole('button', { name: 'Proses ulang' }).click()
  await expect(page.locator(`[data-event-id="${primary.eventId}"]`)).toHaveCount(0)
  await expect(page.locator(`[data-event-id="${pending.find((e:{eventId:string}) => e.eventId !== primary.eventId).eventId}"]`)).toHaveCount(0)
  const invoice = (await (await page.request.get(`/api/v1/finance/customer-invoices/${i.id}`)).json()).data; expect(invoice.status).toBe('void')
  const source = (await (await page.request.get(`/api/v1/accounting/sources/customer_invoice/${i.id}`)).json()).data; expect(source.status).toBe('posted'); expect(source.journals).toHaveLength(2)
  const balance = (await (await page.request.get(`/api/v1/accounting/trial-balance?asOf=${businessDate()}`)).json()).data; expect(balance.balanced).toBe(true); expect(balance.netProfitMinor).toBeNull()
  expect(balance.rows.filter((r:{code:string}) => ['1110', '2130'].includes(r.code)).every((r:{balanceMinor:string}) => r.balanceMinor === '0')).toBe(true)
  expect(await bank()).toBe(before)
  const setup = (await (await page.request.get('/api/v1/accounting/setup')).json()).data; expect(setup.book.mode).toBe('shadow'); expect(setup.policies.find((p:{id:string}) => p.id === draft.id).validationStatus).toBe('draft')
  await page.reload(); await page.getByText('Pengaturan periode dan usulan kebijakan', { exact: true }).click()
  const row = page.locator(`[data-policy-id="${result.id}"]`); await expect(row).toContainText('test-only')
  for (const width of [1440, 768, 390]) { await page.setViewportSize({ width, height: 960 }); await row.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`policy-rehearsal-${width}.png`), fullPage: false, animations: 'disabled' }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true) }
  expect(errors).toEqual([])
})

test('owner matches a supplier invoice to its actual receipt and undoes it without cash', async ({ page, request }, info) => {
  const health = await (await request.get('/api/v1/health')).json()
  expect(health.data.environment).toBe('test'); expect(health.data.database.engine).toBe('pglite')
  const errors:string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.goto('/login'); await page.getByRole('button', { name: /Masuk sebagai .*Super Admin/i }).click()
  await expect(page).toHaveURL(/localhost:8080\/$/)
  const post = async (path:string, data:unknown) => {
    const r = await page.request.post(`/api/v1${path}`, { data, headers: { 'idempotency-key': crypto.randomUUID(), origin: 'http://localhost:8080' } })
    expect(r.ok(), await r.text()).toBe(true); return (await r.json()).data
  }
  const bank = async () => (await (await page.request.get('/api/v1/finance/accounts/BA-UAT')).json()).data.balance.currentMinor
  const before = await bank()
  const f = await post('/finance/fulfillments', { side: 'supplier', salesOrderId: 'SLO-UAT-MATCH', vendorId: 'VND-001', amountMinor: '60000000', fulfilledOn: '2026-10-02', basis: 'estimate', isFinal: true, evidence: 'TEST_ONLY browser actual supplier delivery' })
  const number = `TEST_ONLY-MATCH-${Date.now()}`
  const i = await post('/finance/vendor-invoices', { vendorId: 'VND-001', salesOrderId: 'SLO-UAT-MATCH', vendorInvoiceNumber: number, invoiceDate: '2026-09-30', dueDate: '2026-11-01', totalMinor: '70000000' })
  await post(`/finance/vendor-invoices/${i.id}/review`, { action: 'approve' })
  await page.goto('/sales-orders/SLO-UAT-MATCH')
  await page.getByRole('button', { name: new RegExp(number) }).click()
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Cocokkan penerimaan jasa', exact: true }).click()
  const form = dialog.getByRole('form', { name: 'Cocokkan penerimaan jasa' })
  await form.locator('[name="fulfillmentId"]').selectOption(f.id)
  await expect(form.locator('[name="postingDate"]')).toHaveValue('2026-10-02')
  await expect(form.locator('[name="closesReceipt"]')).not.toBeChecked()
  await form.locator('[name="actualMinor"]').fill('70000000')
  await form.locator('[name="reason"]').fill('TEST_ONLY final invoice verified in browser')
  await form.locator('[name="confirmed"]').check()
  await expect(form.getByRole('button', { name: 'Simpan pencocokan' })).toBeDisabled()
  await form.locator('[name="closesReceipt"]').check()
  await form.getByRole('button', { name: 'Simpan pencocokan' }).click()
  await expect(dialog.getByRole('button', { name: 'Batalkan pencocokan', exact: true })).toBeVisible()
  const summary = async () => (await (await page.request.get('/api/v1/accounting/orders/SLO-UAT-MATCH/summary')).json()).data
  expect((await summary()).figures).toMatchObject({ directCostMinor: '70000000', prepaidCostMinor: '0', accruedCostMinor: '0' })
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 }); await page.screenshot({ path: info.outputPath(`supplier-receipt-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
  await page.keyboard.press('Escape'); await page.reload()
  await page.getByRole('button', { name: new RegExp(number) }).click()
  await page.getByRole('button', { name: 'Batalkan pencocokan', exact: true }).click()
  const reason = page.getByRole('dialog').last()
  await reason.getByLabel(/Alasan/).fill('TEST_ONLY wrong receipt corrected')
  await reason.getByRole('button', { name: 'Batalkan pencocokan', exact: true }).click()
  await expect(page.getByRole('dialog').getByText('TEST_ONLY wrong receipt corrected', { exact: false })).toBeVisible()
  expect((await summary()).figures).toMatchObject({ directCostMinor: '60000000', prepaidCostMinor: '70000000', accruedCostMinor: '60000000' })
  expect(await bank()).toBe(before); expect(errors).toEqual([])
})
test('owner finance journey uses a live isolated backend at desktop, tablet and phone sizes', async ({ page, request }, info) => {
  const health = await (await request.get('/api/v1/health')).json()
  expect(health.data.environment).toBe('test')
  expect(health.data.database.engine).toBe('pglite')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  // No third-party integrations are needed by this rehearsal.
  await page.route('**/*', (route) => {
    const u = new URL(route.request().url())
    return ['localhost', '127.0.0.1'].includes(u.hostname) ? route.continue() : route.abort()
  })
  await page.goto('/login')
  await page.getByRole('button', { name: /Masuk sebagai .*Super Admin/i }).click()
  await expect(page).toHaveURL(/localhost:8080\/$/)
  await page.goto('/finance/accounting')
  await expect(page.getByText('TEST_ONLY HTTP rehearsal', { exact: false }).first()).toBeVisible()
  const me = await (await page.request.get('/api/v1/auth/me')).json()
  expect(me.data.user.id).toBe('USR-010')
  const setup = await (await page.request.get('/api/v1/accounting/setup')).json()
  expect(setup.data.book.mode).toBe('shadow')
  const orders = await (await page.request.get('/api/v1/sales-orders')).json()
  const order = orders.data.find((o: { destination: string; projectId: string | null }) => o.destination === 'TEST_ONLY' && o.projectId === null)
  expect(order).toBeTruthy()
  await page.goto(`/sales-orders/${order.id}`)
  await expect(page.getByRole('heading', { name: 'Hasil accounting order' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Invoice supplier order' })).toBeVisible()
  await expect(page.getByText(`TEST_ONLY-HTTP-${order.id}`, { exact: false }).first()).toBeVisible()
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.screenshot({ path: info.outputPath(`native-order-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `horizontal overflow at ${width}`).toBe(true)
  }
  await page.getByRole('button', { name: 'Catat invoice asli', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hasil accounting order' })).toBeVisible()
  expect(errors).toEqual([])
})

test('owner configures an approved CR in the UI and opens its real protected invoice draft', async ({ page, request }, info) => {
  const health = await (await request.get('/api/v1/health')).json()
  expect(health.data.environment).toBe('test')
  expect(health.data.database.engine).toBe('pglite')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.goto('/login')
  await page.getByRole('button', { name: /Masuk sebagai .*Super Admin/i }).click()
  await expect(page).toHaveURL(/localhost:8080\/$/)
  const post = async (path: string, data: unknown = {}) => {
    const r = await page.request.post(`/api/v1${path}`, { data, headers: { 'idempotency-key': crypto.randomUUID(), origin: 'http://localhost:8080' } })
    expect(r.ok(), await r.text()).toBe(true)
    return (await r.json()).data
  }
  const cr = await post('/projects/PRJ-101/change-requests', { source: 'internal', beforeSummary: 'TEST_ONLY browser original', afterSummary: 'TEST_ONLY browser extra', commercialImpactMinor: '10000000' })
  await post(`/change-requests/${cr.id}/review`)
  await post(`/change-requests/${cr.id}/approve`)
  await page.goto(`/changes/${cr.id}`)
  await page.getByRole('button', { name: 'Tentukan penagihan' }).click()
  const form = page.getByRole('form', { name: 'Rencana tagihan perubahan' })
  await form.locator('[name="mode"]').selectOption('charge')
  await expect(form.locator('[name="basis"]')).toHaveValue('')
  await form.locator('[name="basis"]').selectOption('commercial')
  await form.locator('[name="target-0"]').selectOption('project')
  await form.locator('[name="amount-0"]').fill('10000000')
  await form.locator('[name="due-0"]').fill('2026-11-01')
  await form.locator('[name="reason"]').fill('TEST_ONLY customer browser approval')
  await form.locator('[name="confirmed"]').check()
  await form.getByRole('button', { name: 'Simpan rencana' }).click()
  await page.getByRole('button', { name: 'Buka invoice · draft' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(cr.id, { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Ubah draft' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Terbitkan invoice' })).toBeVisible()
  await page.keyboard.press('Escape')
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.screenshot({ path: info.outputPath(`change-billing-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  }
  await page.reload()
  await expect(page.getByRole('button', { name: 'Buka invoice · draft' })).toBeVisible()
  const status = await (await page.request.get(`/api/v1/finance/change-requests/${cr.id}/billing`)).json()
  expect(status.data.plans).toHaveLength(1)
  expect(status.data.plans[0].status).toBe('applied')
  expect(errors).toEqual([])
})

test('owner uploads and downloads original private evidence without changing money', async ({ page, request }, info) => {
  const health = await (await request.get('/api/v1/health')).json()
  expect(health.data.environment).toBe('test'); expect(health.data.database.engine).toBe('pglite')
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  await page.goto('/login'); await page.getByRole('button', { name: /Masuk sebagai .*Super Admin/i }).click()
  await expect(page).toHaveURL(/localhost:8080\/$/)
  const bank = async () => (await (await page.request.get('/api/v1/finance/accounts/BA-UAT')).json()).data.balance.currentMinor
  const before = await bank()
  const orders = await (await page.request.get('/api/v1/sales-orders')).json()
  const order = orders.data.find((o: { destination: string; projectId: string|null }) => o.destination === 'TEST_ONLY' && o.projectId === null)
  const invoices = await (await page.request.get(`/api/v1/finance/payables?view=all&salesOrderId=${order.id}`)).json()
  const invoice = invoices.data[0]
  expect(invoice).toBeTruthy()
  await page.goto(`/sales-orders/${order.id}`)
  await page.getByRole('button', { name: new RegExp(`TEST_ONLY-HTTP-${order.id}`) }).click()
  const dialog = page.getByRole('dialog')
  const content = Buffer.from('%PDF-1.4\nTEST_ONLY browser original evidence\n%%EOF')
  await dialog.getByLabel(/File asli \(PDF/).setInputFiles({ name: 'TEST_ONLY-browser.pdf', mimeType: 'application/pdf', buffer: content })
  await dialog.getByRole('button', { name: 'Unggah file asli', exact: true }).click()
  await expect(dialog.getByText('TEST_ONLY-browser.pdf tersimpan sebagai file privat.')).toBeVisible()
  const waiting = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Unduh asli', exact: true }).click()
  const downloaded = await waiting
  const path = info.outputPath('original-evidence.pdf')
  await downloaded.saveAs(path)
  expect(await readFile(path)).toEqual(content)
  const files = await (await page.request.get(`/api/v1/private-files?sourceType=vendor_invoice&sourceId=${invoice.id}`)).json()
  expect(files.data.items).toHaveLength(1)
  expect(files.data.items[0].visibility).toBe('internal')
  expect(await bank()).toBe(before)
  await page.setViewportSize({ width: 390, height: 960 })
  await page.screenshot({ path: info.outputPath('private-evidence-390.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})
