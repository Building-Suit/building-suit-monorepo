import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const orderId = '00000000-0000-4000-8000-000000000211', lineId = '00000000-0000-4000-8000-000000000212'
for (const locale of ['en','ar']) test(`reserve and release order stock with unconfirmed retry ${locale}`, async ({ page }) => {
 const ar = locale === 'ar'; let held = '0', revision = 1, loseResponse = true
 const results = new Map<string, object>()
 await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
 await page.addInitScript(dark => localStorage.setItem('building-suit.theme',dark ? 'dark' : 'light'),ar)
 const { calls } = await pilotFixture(page,locale,'owner',(name,args) => {
  if (name === 'trade_order_context') return { items: [], total: 0, page: 1, pageSize: 20, quotation: null, canManage: true, detail: args.p_order_id ? { record: { id: orderId, order_number: 'O-RESERVE-1', status: 'open', revision, currency: 'EGP', agreed_snapshot: { customerName: 'Reservation contractor', projectReference: 'Site B', quotationNumber: 'Q-RESERVE-1', version: 1, currency: 'EGP', orderDiscount: '0', net: '3500', tax: '0', total: '3500', lines: [] } }, lines: [], events: [], eventCount: 0, historyPage: 1 } : null }
  if (name === 'trade_order_reservation_context') return { items: held === '0' ? [] : [{ id: 'reservation-1', line_id: lineId, barcode: 'SOURCE-REEL-1', quantity: held, sale_quantity: held, remaining_quantity: held, remaining_sale_quantity: held, status: 'active', expires_at: '2026-12-31T12:00:00Z' }], total: held === '0' ? 0 : 1, page: 1, pageSize: 20, history: [], historyTotal: 0, historyPage: 1, revision, status: 'open', serverNow: new Date().toISOString(), canManage: true, stock: [{ lineId, productId: 'product-1', name: 'Contract cable', unitCode: 'm', unitNameEn: 'Meter', unitNameAr: 'متر', orderedQuantity: '100', onHand: '200', reserved: held, orderReserved: held, available: held === '0' ? '200' : '120', reelTracked: true }] }
  return undefined
 })
 await fixtureRoute(page,'**/rest/v1/rpc/reserve_trade_order',async route => {
  const args = route.request().postDataJSON() as Record<string,unknown>; calls.push({ name: 'reserve_trade_order', args })
  const id = String(args.p_request_id)
  if (!results.has(id)) { held = args.p_action === 'reserve' ? '80' : '0'; revision++; results.set(id,{ id: orderId, revision, status: 'open', allocations: held === '0' ? 0 : 1 }) }
  if (loseResponse) { loseResponse = false; await route.fulfill({ status: 503, json: { message: 'Synthetic committed hold response lost' } }) }
  else await route.fulfill({ json: results.get(id) })
 })
 await fixtureGoto(page,`/orders?order=${orderId}`)
 const detail = page.getByRole('dialog',{ name: 'O-RESERVE-1',exact: true }), reserveName = ar ? 'حجز مخزون للأمر' : 'Reserve order stock'
 await detail.getByRole('button',{name:reserveName,exact:true}).click()
 const editor = page.getByRole('dialog',{name:reserveName,exact:true})
 const quantity = editor.getByLabel('Contract cable (m)',{exact:true})
 await quantity.fill('80')
 await editor.getByLabel(ar ? 'سبب إجراء الحجز' : 'Reservation reason',{exact:true}).fill('Hold for site B collection')
 await editor.getByRole('button',{name:reserveName,exact:true}).click()
 await expect(editor.getByRole('alert')).toContainText(ar ? 'لم تتأكد النتيجة' : 'The result is unconfirmed')
 await expect(quantity).toBeDisabled()
 // Closing the pending background order must not discard the unresolved request.
 await editor.press('Escape')
 await expect(editor).toBeVisible()
 await expect(detail).toBeVisible()
 await editor.getByRole('button',{name:reserveName,exact:true}).click()
 await expect(editor).toHaveCount(0)
 await expect(detail).toContainText('SOURCE-REEL-1')
 const holds = calls.filter(c=>c.name==='reserve_trade_order')
 expect(holds).toHaveLength(2); expect(holds[0]!.args).toEqual(holds[1]!.args)
 expect(holds[0]!.args).toMatchObject({ p_revision: 1, p_action: 'reserve', p_lines: [{lineId,quantity:'80',cuttingLoss:'0'}] })
 const releaseName = ar ? 'تحرير حجوزات الأمر' : 'Release order holds'
 await detail.getByRole('button',{name:releaseName,exact:true}).click()
 const release = page.getByRole('dialog',{name:releaseName,exact:true})
 await release.getByLabel(ar ? 'سبب إجراء الحجز' : 'Reservation reason',{exact:true}).fill('Contractor postpones collection')
 await release.getByRole('button',{name:releaseName,exact:true}).click()
 await expect(release).toHaveCount(0)
 expect(calls.filter(c=>c.name==='reserve_trade_order').at(-1)!.args).toMatchObject({p_revision:2,p_action:'release',p_lines:[],p_expires_at:null})
 expect(results.size).toBe(2)
 expect(calls.some(c=>['issue_sale','issue_location_sale','record_customer_receipt','save_pos_sale_draft'].includes(c.name))).toBe(false)
 await expectNoPageOverflow(page)
 await page.screenshot({path:test.info().outputPath('order-reservations.png'),fullPage:true})
})
test('read-only order stock never offers reservation commands',async ({page}) => {
 const {calls} = await pilotFixture(page,'en','employee',(name,args) => {
  if(name==='trade_order_context') return {items:[],total:0,page:1,pageSize:20,quotation:null,canManage:false,detail:args.p_order_id?{record:{id:orderId,order_number:'O-READ-1',status:'open',revision:1,currency:'EGP',agreed_snapshot:{customerName:'Read only contractor',quotationNumber:'Q-READ-1',version:1,currency:'EGP',total:'0',net:'0',tax:'0',orderDiscount:'0',lines:[]}},lines:[],events:[],eventCount:0}:null}
  if(name==='trade_order_reservation_context') return {items:[],total:0,history:[],historyTotal:0,stock:[],revision:1,status:'open',canManage:false}
  return undefined
 })
 await fixtureGoto(page,`/orders?order=${orderId}`)
 const dialog=page.getByRole('dialog',{name:'O-READ-1',exact:true})
 await expect(dialog.getByRole('heading',{name:'Stock reservations',exact:true})).toBeVisible()
 await expect(dialog.getByRole('button',{name:/Reserve order stock|Release order holds|Cancel order/})).toHaveCount(0)
 expect(calls.some(c=>c.name==='reserve_trade_order')).toBe(false)
})
