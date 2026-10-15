import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import ts from 'typescript'
import { renderReceiptDocument } from '../src/utils/receiptDocument.ts'

const root = new URL('../../../', import.meta.url)
const read = path => readFile(new URL(path, root))
const fonts = await Promise.all([400, 600, 700].map(async weight => `@font-face{font-family:'IBM Plex Sans Arabic';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${(await read(`node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-${weight}-normal.woff2`)).toString('base64')}) format('woff2')}`))
const tokens = await read('packages/design-tokens/generated/tokens.css')
const receiptFont = await read('packages/ui/node_modules/@fontsource-variable/roboto-condensed/files/roboto-condensed-latin-wght-normal.woff2')
fonts.push(`@font-face{font-family:'Roboto Condensed Variable';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${receiptFont.toString('base64')}) format('woff2')}`)
const headingFont = await read('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2')
fonts.push(`@font-face{font-family:'Manrope Variable';font-style:normal;font-weight:200 800;src:url(data:font/woff2;base64,${headingFont.toString('base64')}) format('woff2')}`)
const css = `${tokens}\n${fonts.join('')}\n`
const source = (await read('packages/ux/src/utils/documentImage.ts')).toString().replace("import('html-to-image')", 'Promise.resolve(window.htmlToImage)').replace(/^export /gm, '')
const controller = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const view = {
  issuer: 'Building Suit', issuerDetails: [], invoice: 'SALE-000005', issued: '2021/10/05 6:08 PM',
  location: { name: 'Business Suit', code: '0001', address: 'District B, Badr City', phone: '+201500240770' }, staff: 'Tareq Mohamed', customer: 'Ahmed Barber Shop',
  lines: [{ id: '1', label: 'Shop Suit', quantity: '2', unitPrice: 'EGP 999.00', total: 'EGP 1,998.00' }, { id: '2', label: 'أدوات تجميل', quantity: '1', unitPrice: 'EGP 1,200.00', total: 'EGP 1,200.00' }],
  totals: [{ id: 'subtotal', label: 'Subtotal', value: 'EGP 3,198.00' }, { id: 'paid', label: 'Total Paid', value: 'EGP 3,198.00', emphasis: true }], payments: [{ id: '1', summary: 'Cash', reference: '226256' }],
  // Reference-only merchant text. The renderer never supplies this content.
  footer: 'Tareq Abdelwhap | CEO, CTO & Founder @ Building Suit',
}
const copy = { title: 'SALES RECEIPT', reprintLabel: 'REPRINT / COPY', invoice: 'Sale No.', date: 'Date & Time', location: 'Branch', address: 'Address', phone: 'Phone', staff: 'Cashier', customer: 'Customer', items: 'Items', item: 'Product / Service', quantity: 'Qty', unitPrice: 'Unit Price', lineTotal: 'Amount', total: 'Total Paid', payment: 'Payment', reference: 'Reference No.', thankYou: 'Thank you', greeting: 'Hope you have a good day', issuedVia: 'Issued via Shop Suit by Building Suit', compliance: 'This is proof of sale only — not an Egyptian tax invoice or e-receipt approved by the Tax Authority.' }

for (const language of ['en', 'ar']) test(`receipt ${language}: deterministic render, original-reference comparison and complete PNG clipboard`, async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 })
    const requests = []
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname === '/brand/shop-suit-mark-light.svg') return route.fulfill({ contentType: 'image/svg+xml', body: await read('packages/brand/assets/shop-suit-mark-light.svg') })
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' })
      requests.push(route.request().url())
      return route.abort()
    })
    await page.goto('http://receipt.test/')
    const model = structuredClone(view)
    const labels = { ...copy }
    if (language === 'ar') {
      Object.assign(labels, { title: 'إيصال بيع', invoice: 'رقم البيع', date: 'التاريخ والوقت', location: 'الفرع', address: 'العنوان', phone: 'الهاتف', staff: 'الموظف', customer: 'العميل', item: 'المنتج / الخدمة', quantity: 'الكمية', unitPrice: 'سعر الوحدة', lineTotal: 'المبلغ', payment: 'الدفع', reference: 'الرقم المرجعي', thankYou: 'شكرًا لزيارتكم', greeting: 'نتمنى لكم يومًا سعيدًا', issuedVia: 'صادر عبر Shop Suit by Building Suit', compliance: 'هذا الإيصال لأغراض محاسبية فقط — وليس فاتورة ضريبية معتمدة من مصلحة الضرائب.' })
      model.issued = '2021/10/05 6:08 م'
      model.lines.forEach(line => { line.unitPrice = line.unitPrice.replace('EGP ', '') + ' ج.م.'; line.total = line.total.replace('EGP ', '') + ' ج.م.' })
      model.totals = [{ id: 'subtotal', label: 'الإجمالي قبل الخصم', value: '3,198.00 ج.م.' }, { id: 'paid', label: 'إجمالي المدفوع', value: '3,198.00 ج.م.', emphasis: true }]
      model.payments[0].summary = 'نقدي'
    }
    const markup = renderReceiptDocument(model, labels, language)
    await page.setContent(`<style>body{margin:0;background:white}${css}</style>${markup}<button id="copy">Copy</button>`)
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.bs-receipt-credit img').evaluate(img => img.decode())
    const paper = page.locator('[data-receipt-document]')
    const overflowing = await paper.evaluate(node => [...node.querySelectorAll('*')].filter(element => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0).map(element => element.className))
    assert.deepEqual(overflowing, [])
    const screenshot = await paper.screenshot()
    const baselinePath = new URL(`packages/ui/tests/fixtures/receipt-baselines/${language}.png`, root)
    if (process.env.UPDATE_RECEIPT_BASELINES === '1') await writeFile(baselinePath, screenshot)
    const baseline = await readFile(baselinePath)
    const baselineError = await page.evaluate(async ({ a, b }) => {
      const load = async data => { const image = new Image(); image.src = data; await image.decode(); return image }
      const [expected, actual] = await Promise.all([load(a), load(b)])
      if (expected.width !== actual.width || expected.height !== actual.height) return 1
      const canvas = document.createElement('canvas'); canvas.width = expected.width; canvas.height = expected.height
      const context = canvas.getContext('2d'); context.filter = 'blur(.5px)'
      context.drawImage(expected, 0, 0); const left = context.getImageData(0, 0, canvas.width, canvas.height).data
      let best = { error: 1, dx: 0, dy: 0, unalignedError: 1 }
      // 80 mm has a fractional CSS-pixel width. Screenshot crop rounding and
      // FreeType builds can differ by one pixel between Linux runners.
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(actual, dx, dy)
        const right = context.getImageData(0, 0, canvas.width, canvas.height).data
        let delta = 0
        for (let i = 0; i < left.length; i += 4) delta += Math.abs(left[i] - right[i])
        const error = delta / (canvas.width * canvas.height * 255)
        if (dx === 0 && dy === 0) best.unalignedError = error
        if (error < best.error) best = { ...best, error, dx, dy }
      }
      return best
    }, { a: `data:image/png;base64,${baseline.toString('base64')}`, b: `data:image/png;base64,${screenshot.toString('base64')}` })
    console.log(language, 'clean baseline comparison', baselineError)
    assert.ok(typeof baselineError !== 'number' && baselineError.error < 0.01, `Receipt ${language} differs from its reviewed clean baseline: ${JSON.stringify(baselineError)}`)
    const output = new URL('test-results/receipt/', root)
    await mkdir(output, { recursive: true })
    await writeFile(new URL(`${language}.png`, output), screenshot)
    await page.addScriptTag({ content: (await read('packages/ux/node_modules/html-to-image/dist/html-to-image.js')).toString() })
    await page.addScriptTag({ content: `${controller}\nwindow.receiptCopy = copyDocumentImage; window.receiptRender = renderDocumentImage; window.receiptDownload = downloadDocumentImage;` })
    await page.evaluate(markup => {
      window.copyResult = 'pending'
      window.ClipboardItem = class { constructor(data) { this.data = data } }
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => {
        const png = await items[0].data['image/png']
        window.copiedImage = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(png) })
      } } })
      document.querySelector('#copy').onclick = () => window.receiptCopy(() => window.receiptRender(markup)).then(() => { window.copyResult = 'success' }, error => { window.copyResult = error.message })
    }, markup)
    await page.locator('#copy').click()
    await page.waitForFunction(() => window.copyResult !== 'pending')
    assert.equal(await page.evaluate(() => window.copyResult), 'success')
    const png = await page.evaluate(() => window.copiedImage)
    await writeFile(new URL(`${language}-copied.png`, output), Buffer.from(png.split(',')[1], 'base64'))
    const rasterError = await page.evaluate(async ({ screenshot, png }) => {
      const load = async src => { const img = new Image(); img.src = src; await img.decode(); return img }
      const [expected, actual] = await Promise.all([load(screenshot), load(png)])
      const canvas = document.createElement('canvas'); canvas.width = expected.width; canvas.height = expected.height
      const context = canvas.getContext('2d')
      context.filter = 'blur(1px)'
      context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(expected, 0, 0)
      const a = context.getImageData(0, 0, canvas.width, canvas.height).data
      context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(actual, 0, 0, canvas.width, canvas.height)
      const b = context.getImageData(0, 0, canvas.width, canvas.height).data
      let delta = 0
      for (let i = 0; i < a.length; i += 4) delta += Math.abs(a[i] - b[i])
      return delta / (canvas.width * canvas.height * 255)
    }, { screenshot: `data:image/png;base64,${screenshot.toString('base64')}`, png })
    console.log(language, 'PNG versus preview error', rasterError)
    assert.ok(rasterError < 0.025, 'PNG must preserve preview fonts, shaping, positions and footer')
    const dimensions = await page.evaluate(async data => { const image = new Image(); image.src = data; await image.decode(); return { width: image.width, height: image.height } }, png)
    const box = await paper.boundingBox()
    assert.equal(dimensions.width, Math.ceil(box.width) * 3)
    assert.ok(dimensions.height >= Math.ceil(box.height) * 3)
    assert.equal(await page.locator('[aria-hidden="true"] [data-receipt-document]').count(), 0)
    assert.deepEqual(requests, [])
    const reference = await read(`packages/ui/tests/fixtures/receipt-references/${language === 'ar' ? '1000165558' : '1000165557'}.jpg`)
    // Compare clean output with the photographed reference after cropping its
    // background and normalizing size. Report error honestly; no "pixel-perfect" gate.
    const comparison = await page.evaluate(async ({ original, actual }) => {
      const load = async src => { const image = new Image(); image.src = src; await image.decode(); return image }
      const [reference, rendered] = await Promise.all([load(original), load(actual)])
      const width = 300, height = 690
      const canvas = document.createElement('canvas'); canvas.width = width * 3; canvas.height = height
      const context = canvas.getContext('2d')
      context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, height)
      context.drawImage(reference, 103, 0, 694, 1600, 0, 0, width, height)
      context.drawImage(rendered, width, 0, width, height)
      const left = context.getImageData(0, 0, width, height), right = context.getImageData(width, 0, width, height)
      let error = 0
      for (let i = 0; i < left.data.length; i += 4) { const delta = Math.abs(left.data[i] - right.data[i]); error += delta; const j = i; left.data[j] = delta; left.data[j+1] = delta; left.data[j+2] = delta }
      context.putImageData(left, width * 2, 0)
      return { meanAbsoluteError: error / (width * height * 255), image: canvas.toDataURL(), originalSize: [reference.width, reference.height], renderedSize: [rendered.width, rendered.height] }
    }, { original: `data:image/jpeg;base64,${reference.toString('base64')}`, actual: `data:image/png;base64,${screenshot.toString('base64')}` })
    await writeFile(new URL(`${language}-reference-comparison.png`, output), Buffer.from(comparison.image.split(',')[1], 'base64'))
    delete comparison.image
    await writeFile(new URL(`${language}-comparison.json`, output), JSON.stringify(comparison, null, 2))
    console.log(language, comparison)
    // A long receipt must grow rather than clip. Render this with the same capture path.
    const long = { ...model, lines: Array.from({ length: 30 }, (_, index) => ({ ...model.lines[index % 2], id: String(index), label: `Long product / خدمة ${index} with an extended descriptive name` })) }
    const longMarkup = renderReceiptDocument(long, labels, language)
    await page.evaluate(async markup => { const png = await window.receiptRender(markup); window.longBlob = png.size }, longMarkup)
    assert.ok(await page.evaluate(() => window.longBlob) > 10000)
  }
  finally { await browser.close() }
})
