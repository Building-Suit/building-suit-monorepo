import ts from 'typescript'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const result = { version: JSON.parse(await readFile(path.resolve(path.dirname(require.resolve('primevue/datatable')), '../package.json'), 'utf8')).version, components: {} }
for (const component of ['datatable', 'column']) {
  const file = require.resolve(`primevue/${component}`).replace(/index\.mjs$/, 'index.d.ts')
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const declarations = {}
  for (const node of source.statements) if (ts.isInterfaceDeclaration(node) && /(?:Props|Slots|EmitsOptions)$/.test(node.name.text)) {
    declarations[node.name.text] = node.members.map(member => member.name?.getText(source)).filter(Boolean)
  }
  result.components[component] = declarations
}
const dir = new URL('../../docs/shared/generated/', import.meta.url)
await mkdir(dir, { recursive: true })
await writeFile(new URL('primevue-table-api.json', dir), `${JSON.stringify(result, null, 2)}\n`)
console.log(`Inventoried PrimeVue ${result.version} DataTable and Column interfaces.`)
