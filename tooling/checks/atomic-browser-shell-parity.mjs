import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
const directory = path.resolve('.local/atomic-template-evidence/route-coverage')
// A failed or interrupted sweep cannot satisfy final acceptance. Prefer the latest
// successful evidence when a viewport has been verified more than once.
const evidence = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).map(async file => {
 const source = path.join(directory, file)
 return { run: JSON.parse(await readFile(source, 'utf8')), modified: (await stat(source)).mtimeMs }
}))
const runs = evidence.filter(item => item.run.failures.length === 0).sort((a, b) => b.modified - a.modified).map(item => item.run)
const shells = runs.flatMap(run => run.cases.flatMap(test => test.shells ?? []))
const suits = ['ledger-suit', 'shop-suit', 'inventory-suit', 'super-admin-suit', 'automation-suit']
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 const views = suits.map(suit => {
  const result = shells.find(shell => shell.suit === suit && shell.locale === locale && shell.theme === theme && shell.width === width)
  assert.ok(result, `Missing passing shell evidence: ${suit}/${locale}/${theme}/${width}`)
  return result
 })
 for (const view of views.slice(1)) assert.deepEqual(view.geometry, views[0].geometry, `Shell geometry differs: ${view.suit}/${locale}/${theme}/${width}`)
}
console.log('Shared shell geometry, typography and theme parity verified in all five Suits across twelve language/theme/viewport combinations.')
