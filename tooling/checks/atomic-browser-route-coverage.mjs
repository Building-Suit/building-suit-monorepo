import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
const root = new URL('../../', import.meta.url).pathname
const registry = JSON.parse(await readFile(path.join(root, 'docs/shared/atomic-template-route-inventory.json'), 'utf8'))
const directory = path.join(root, '.local/atomic-template-evidence/route-coverage')
// A failed or interrupted sweep cannot satisfy final acceptance. Prefer the latest
// successful evidence when a viewport has been verified more than once.
const evidence = await Promise.all((await readdir(directory)).filter(file => file.endsWith('.json')).map(async file => {
 const source = path.join(directory, file)
 return { run: JSON.parse(await readFile(source, 'utf8')), modified: (await stat(source)).mtimeMs }
}))
const runs = evidence.filter(item => item.run.failures.length === 0).sort((a, b) => b.modified - a.modified).map(item => item.run)
const routes = runs.flatMap(run => run.cases.flatMap(test => test.routes))
const missing = []
for (const entry of registry.entries.filter(entry => entry.kind === 'route')) {
 const suit = entry.source.split('/')[1]
 const routePath = entry.source.split('/app/pages/')[1].replace(/\.vue$/, '').replace(/(^|\/)index$/, '').replace(/^\//, '')
 const expression = routePath.split('/').map(segment => /^\[\.\.\./.test(segment) ? '.+' : /^\[/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')
 const pattern = new RegExp(`^/${expression}$`)
 if (!routes.some(route => route.suit === suit && pattern.test(route.path))) missing.push(entry.source)
}
if (missing.length) { console.error(`Unverified browser routes (${missing.length}):\n${missing.join('\n')}`); process.exitCode = 1 }
else console.log(`Browser coverage verified all ${registry.entries.filter(entry => entry.kind === 'route').length} registered Suit routes using passing browser tests.`)
