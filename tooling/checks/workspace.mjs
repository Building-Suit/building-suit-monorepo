import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
const root = new URL('../../', import.meta.url).pathname
const failures = []
const applicationPackages = ['ledger-suit', 'shop-suit', 'inventory-suit']
const applicationImport = new RegExp(`@building-suit/(?:${applicationPackages.join('|')})`)
const forbidden = new RegExp(`(?:from\\s*|import\\s*\\()\\s*['"][^'"]*(?:/apps/|${applicationImport.source})`)
async function walk(relative) {
  const files = []
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (['node_modules', '.nuxt', '.output', '.turbo', 'generated', 'reference', 'content', 'public'].includes(entry.name)) continue
    const file = `${relative}/${entry.name}`
    if (entry.isDirectory()) files.push(...await walk(file))
    else if (/\.(?:vue|ts|mjs)$/.test(file)) files.push(file)
  }
  return files
}
for (const file of await walk('packages')) {
  if (file.startsWith('packages/testing/')) continue
  const text = await readFile(path.join(root, file), 'utf8')
  if (forbidden.test(text)) failures.push(`${file}: shared code imports an application`)
}
for (const app of applicationPackages) for (const file of await walk(`apps/${app}/app`)) {
  const text = await readFile(path.join(root, file), 'utf8')
  if (/<table\b|<DataTable\b|role="dialog"/.test(text)) failures.push(`${file}: bypasses the shared table or dialog`)
  if (applicationImport.test(text)) failures.push(`${file}: imports another app`)
  if (/window\.confirm\(|\bconfirm\(/.test(text)) failures.push(`${file}: bypasses shared confirmation`)
}
const manifest = JSON.parse(await readFile(path.join(root, 'docs/migration/copy-manifest.json'), 'utf8'))
let migrations = 0
for (const item of manifest.filter(item => /(?:migrations|shop_crm_migrations)\/.*\.sql$/.test(item.source))) {
  const bytes = await readFile(path.join(root, item.destination))
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256) failures.push(`${item.destination}: historical migration changed`)
  migrations++
}
for (const directory of ['apps', 'packages']) for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const packagePath = `${directory}/${entry.name}/package.json`
  const manifest = JSON.parse(await readFile(path.join(root, packagePath), 'utf8'))
  for (const target of Object.values(manifest.exports || {})) {
    if (typeof target !== 'string' || target.includes('*')) continue
    try { await readFile(path.resolve(root, directory, entry.name, target)) } catch { failures.push(`${packagePath}: missing export ${target}`) }
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log(`Workspace boundaries pass; ${migrations} historical migrations unchanged.`)
