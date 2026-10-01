import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const root = new URL('../../', import.meta.url).pathname
const failures = []
const atomicLayers = ['atoms', 'molecules', 'organisms', 'templates']
const ownershipManifestPath = 'docs/shared/ui-ownership-manifest.json'

async function exists(relative) {
  try { await readFile(path.join(root, relative)); return true }
  catch { return false }
}

async function walk(relative) {
  const files = []
  let entries
  try { entries = await readdir(path.join(root, relative), { withFileTypes: true }) }
  catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    if (['node_modules', '.nuxt', '.output', '.turbo', 'generated', 'reference', 'content', 'public'].includes(entry.name)) continue
    const file = `${relative}/${entry.name}`
    if (entry.isDirectory()) files.push(...await walk(file))
    else if (/\.(?:vue|ts|mjs)$/.test(file)) files.push(file)
  }
  return files
}

const appDirectories = (await readdir(path.join(root, 'apps'), { withFileTypes: true }))
  .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit'))
  .map(entry => entry.name)
  .sort()
const applicationPackages = []
for (const app of appDirectories) {
  const packagePath = `apps/${app}/package.json`
  if (!await exists(packagePath)) continue
  const manifest = JSON.parse(await readFile(path.join(root, packagePath), 'utf8'))
  applicationPackages.push(manifest.name)
}
const escapedApplicationPackages = applicationPackages.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
const applicationImport = new RegExp(`(?:${escapedApplicationPackages.join('|')})`)
const forbidden = new RegExp(`(?:from\\s*|import\\s*\\()\\s*['"][^'"]*(?:/apps/|${applicationImport.source})`)

for (const file of await walk('packages')) {
  if (file.startsWith('packages/testing/')) continue
  const text = await readFile(path.join(root, file), 'utf8')
  if (forbidden.test(text)) failures.push(`${file}: shared code imports an application`)
}

const bypassPattern = /<table\b|<(?:DataTable|Dialog|ConfirmDialog)\b|role=["']dialog["']|(?:from\s*|import\s*\()\s*["']primevue\/(?:datatable|dialog|confirmdialog)["']/
const detectedBypasses = []
for (const app of appDirectories) for (const file of await walk(`apps/${app}/app`)) {
  const text = await readFile(path.join(root, file), 'utf8')
  if (bypassPattern.test(text)) detectedBypasses.push(file)
  if (applicationImport.test(text)) failures.push(`${file}: imports another app`)
  if (/window\.confirm\(|\bconfirm\(/.test(text)) failures.push(`${file}: bypasses shared confirmation`)
  if (/<button\b/.test(text)) failures.push(`${file}: BsButton is required for reusable actions`)
  if (/<form\b/.test(text)) failures.push(`${file}: BsForm is required for reusable forms`)
  if (/<(?:Button|Card|Tag|Drawer|Select|AutoComplete)\b|(?:from\s*|import\s*\()\s*["'](?:reka-ui|@nuxt\/ui|radix-vue)["']/.test(text)) {
    failures.push(`${file}: shared wrappers are required for composite controls`)
  }
}

const ownershipManifest = JSON.parse(await readFile(path.join(root, ownershipManifestPath), 'utf8'))
const allowedClassifications = new Set(['shared-presentation-debt', 'product-orchestration', 'obsolete-duplicate'])
const recordedBypasses = new Set()
for (const item of ownershipManifest.bypasses || []) {
  if (!item || typeof item.path !== 'string') { failures.push(`${ownershipManifestPath}: every bypass debt needs a path`); continue }
  if (recordedBypasses.has(item.path)) failures.push(`${ownershipManifestPath}: duplicate bypass debt ${item.path}`)
  recordedBypasses.add(item.path)
  if (!appDirectories.some(app => item.path.startsWith(`apps/${app}/app/`))) failures.push(`${ownershipManifestPath}: bypass debt is not in a discovered Suit ${item.path}`)
  if (!['BsDataTable', 'BsDialog', 'shared-confirmation'].includes(item.requiredSharedOwner)) failures.push(`${ownershipManifestPath}: invalid shared owner for ${item.path}`)
  if (typeof item.rationale !== 'string' || item.rationale.trim().length < 12) failures.push(`${ownershipManifestPath}: ${item.path} bypass debt needs a useful rationale`)
  if (typeof item.approval !== 'string' || !item.approval.trim()) failures.push(`${ownershipManifestPath}: ${item.path} bypass debt needs explicit approval evidence`)
  if (!await exists(item.path)) failures.push(`${ownershipManifestPath}: missing bypass debt file ${item.path}`)
}
for (const file of detectedBypasses) if (!recordedBypasses.has(file)) failures.push(`${file}: bypasses BsDataTable or BsDialog`)
for (const file of recordedBypasses) if (!detectedBypasses.includes(file)) failures.push(`${ownershipManifestPath}: stale bypass debt ${file}`)
const classifiedPaths = new Set()
for (const item of ownershipManifest.components || []) {
  if (!item || typeof item.path !== 'string') { failures.push(`${ownershipManifestPath}: every component needs a path`); continue }
  if (classifiedPaths.has(item.path)) failures.push(`${ownershipManifestPath}: duplicate entry ${item.path}`)
  classifiedPaths.add(item.path)
  if (!/^apps\/[^/]+-suit\/app\/components\/.+\.vue$/.test(item.path)) failures.push(`${ownershipManifestPath}: invalid Suit component path ${item.path}`)
  if (!allowedClassifications.has(item.classification)) failures.push(`${ownershipManifestPath}: invalid classification for ${item.path}`)
  if (typeof item.rationale !== 'string' || item.rationale.trim().length < 12) failures.push(`${ownershipManifestPath}: ${item.path} needs a useful rationale`)
  if (typeof item.approval !== 'string' || !item.approval.trim()) failures.push(`${ownershipManifestPath}: ${item.path} needs explicit approval evidence`)
  if (item.classification !== 'product-orchestration' && (typeof item.migrationTarget !== 'string' || !item.migrationTarget.startsWith('packages/ui/'))) {
    failures.push(`${ownershipManifestPath}: ${item.path} needs a packages/ui migrationTarget`)
  }
  if (!await exists(item.path)) failures.push(`${ownershipManifestPath}: missing classified component ${item.path}`)
}
const localComponents = (await Promise.all(appDirectories.map(app => walk(`apps/${app}/app/components`))))
  .flat().filter(file => file.endsWith('.vue')).sort()
for (const file of localComponents) if (!classifiedPaths.has(file)) failures.push(`${file}: app-local component is not classified in ${ownershipManifestPath}`)
for (const file of classifiedPaths) if (!localComponents.includes(file) && await exists(file)) failures.push(`${ownershipManifestPath}: ${file} is outside a discovered Suit component directory`)

const uiFiles = (await walk('packages/ui/src')).filter(file => file.endsWith('.vue')).sort()
const uiComponentLayers = new Map(uiFiles.map(file => [path.basename(file, '.vue'), atomicLayers.indexOf(file.split('/')[3])]))
for (const file of uiFiles) {
  const sourceLayer = atomicLayers.indexOf(file.split('/')[3])
  if (sourceLayer < 0) { failures.push(`${file}: shared components must live in an Atomic Design directory`); continue }
  const text = await readFile(path.join(root, file), 'utf8')
  for (const match of text.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
    const targetLayer = uiComponentLayers.get(match[1])
    if (targetLayer !== undefined && targetLayer > sourceLayer) failures.push(`${file}: ${match[1]} is an upward Atomic Design dependency`)
  }
  for (const match of text.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
    if (!match[1].startsWith('.')) continue
    const target = path.resolve(path.dirname(path.join(root, file)), match[1])
    const relativeTarget = path.relative(root, target).replaceAll(path.sep, '/')
    const targetLayer = atomicLayers.indexOf(relativeTarget.split('/')[3])
    if (targetLayer > sourceLayer) failures.push(`${file}: ${match[1]} is an upward Atomic Design dependency`)
  }
}

const packageManifests = ['package.json', ...appDirectories.map(app => `apps/${app}/package.json`), 'packages/ui/package.json', 'packages/nuxt-layer/package.json']
for (const file of packageManifests) {
  const manifest = JSON.parse(await readFile(path.join(root, file), 'utf8'))
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
  if (dependencies.primevue && !/^4\./.test(dependencies.primevue)) failures.push(`${file}: UI-D01 requires pinned PrimeVue 4.x`)
  if (dependencies.tailwindcss && !/^4\./.test(dependencies.tailwindcss)) failures.push(`${file}: UI-D01 requires Tailwind 4.x`)
  if (['reka-ui', '@nuxt/ui', 'radix-vue'].some(name => dependencies[name])) failures.push(`${file}: UI-D01 disallows a competing UI foundation`)
}

const uiPackage = JSON.parse(await readFile(path.join(root, 'packages/ui/package.json'), 'utf8'))
const uiExports = uiPackage.exports || {}
if (Object.keys(uiExports).some(key => key.includes('*')) || Object.values(uiExports).some(target => typeof target !== 'string' || target.includes('*'))) {
  failures.push('packages/ui/package.json: shared UI exports must be explicit')
}
const expectedUiTargets = [...uiFiles, 'packages/ui/src/styles/base.css'].map(file => `./${file.slice('packages/ui/'.length)}`).sort()
const actualUiTargets = Object.values(uiExports).sort()
for (const target of expectedUiTargets) if (!actualUiTargets.includes(target)) failures.push(`packages/ui/package.json: missing explicit export for ${target}`)
for (const target of actualUiTargets) if (!expectedUiTargets.includes(target)) failures.push(`packages/ui/package.json: export target is not a governed UI source ${target}`)
const uxPackage = JSON.parse(await readFile(path.join(root, 'packages/ux/package.json'), 'utf8'))
if ({ ...uxPackage.dependencies, ...uxPackage.devDependencies }['@building-suit/ui']) failures.push('packages/ux/package.json: packages/ux must not depend on packages/ui')

const migrationManifest = JSON.parse(await readFile(path.join(root, 'docs/migration/copy-manifest.json'), 'utf8'))
let migrations = 0
for (const item of migrationManifest.filter(item => /(?:migrations|shop_crm_migrations)\/.*\.sql$/.test(item.source))) {
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
else console.log(`Workspace boundaries pass for ${appDirectories.length} dynamically discovered Suits and ${localComponents.length} classified local components; ${migrations} historical migrations unchanged.`)
