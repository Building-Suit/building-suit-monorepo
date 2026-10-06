import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url))
export const defaultDebtManifest = 'docs/shared/suit-ui-boundary-debt.json'
export const debtOwnerTask = 'BS-UI-ZN-CONTRACT-001'

const vueControlTags = new Set(['component', 'slot', 'Transition', 'TransitionGroup', 'KeepAlive', 'Teleport', 'Suspense'])
const vendorTags = new Set([
  'AutoComplete', 'Button', 'Card', 'Column', 'ColumnGroup', 'ConfirmDialog', 'DataTable', 'Dialog',
  'Drawer', 'InputText', 'Menu', 'Message', 'Paginator', 'Password', 'Row', 'Select', 'Skeleton',
  'Tag', 'Textarea', 'Toast', 'ToggleSwitch',
])
const aliases = new Map([
  ['AppIcon', 'packages/ui/atoms/BsIcon'],
  ['EmptyState', 'packages/ui/molecules/BsEmptyState'],
  ['FloatingField', 'packages/ui/molecules/BsField'],
  ['OtpInput', 'packages/ui/molecules/BsOtpInput'],
  ['SectionSkeleton', 'packages/ui/molecules/BsSectionSkeleton'],
  ['SettingsMenu', 'packages/ui/organisms/BsSettingsMenu'],
  ['StatusBadge', 'packages/ui/atoms/BsStatusBadge'],
  ['ToastHost', 'packages/ui/organisms/BsToastHost'],
])
const vendorImportPrefixes = [
  'primevue', '@primevue/', '@hugeicons/', 'gsap', 'motion', '@vueuse/motion', 'lenis', '@rive-app/',
  'reka-ui', '@nuxt/ui', 'radix-vue',
]

function slash(value) {
  return value.replaceAll(path.sep, '/')
}

async function walkVue(directory) {
  const files = []
  let entries
  try { entries = await readdir(directory, { withFileTypes: true }) }
  catch (error) {
    if (error.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walkVue(target))
    else if (entry.isFile() && entry.name.endsWith('.vue')) files.push(target)
  }
  return files
}

export async function discoverSuitVueFiles(root = defaultRoot) {
  const appsRoot = path.join(root, 'apps')
  const suits = (await readdir(appsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit'))
    .map(entry => entry.name)
    .sort()
  const files = []
  for (const suit of suits) files.push(...await walkVue(path.join(appsRoot, suit, 'app')))
  return { suits, files: files.sort() }
}

function location(loc, lineOffset = 0) {
  return { line: loc.start.line + lineOffset, column: loc.start.column }
}

function targetForTag(tag, kind) {
  if (aliases.has(tag)) return aliases.get(tag)
  if (kind === 'nuxt-or-vue-render-tag') return 'packages/ui/templates/Bs application-routing composition'
  if (kind === 'vendor-tag') return tag === 'Column' || tag === 'ColumnGroup' || tag === 'Row'
    ? 'packages/ui/organisms/BsDataTable column contract'
    : `packages/ui/Bs${tag}`
  if (kind === 'native-tag') return 'packages/ui/Bs semantic presentation primitive or composition'
  if (kind === 'app-local-component-tag') return 'packages/ui Bs component with product orchestration moved to script/composable'
  return 'packages/ui canonical Bs-prefixed component'
}

function tagKind(node, localNames) {
  if (node.tag === 'template') return null
  if (node.tag.startsWith('Bs')) return null
  if (node.tagType === 0) return 'native-tag'
  if (node.tag.startsWith('Nuxt') || node.tag === 'ClientOnly' || vueControlTags.has(node.tag)) return 'nuxt-or-vue-render-tag'
  if (vendorTags.has(node.tag)) return 'vendor-tag'
  if (localNames.has(node.tag) || localNames.has(node.tag.replace(/(^|-)(\w)/g, (_match, _dash, letter) => letter.toUpperCase()))) return 'app-local-component-tag'
  return 'non-bs-tag'
}

function presentationAttribute(prop) {
  if (prop.type === 6) {
    const normalized = prop.name.toLowerCase()
    if (normalized === 'class' || normalized === 'style' || normalized === 'pt' || normalized === 'ptoptions') return prop.name
    if (normalized.endsWith('class') || normalized.endsWith('style')) return prop.name
    return null
  }
  if (prop.type !== 7) return null
  if (prop.name === 'html') return 'v-html'
  if (prop.name !== 'bind' || prop.arg?.type !== 4 || !prop.arg.isStatic) return null
  const name = prop.arg.content
  const normalized = name.toLowerCase()
  if (normalized === 'class' || normalized === 'style' || normalized === 'pt' || normalized === 'ptoptions') return name
  if (normalized.endsWith('class') || normalized.endsWith('style')) return name
  return null
}

function importSpecifiers(block) {
  if (!block) return []
  const kind = block.lang === 'ts' || block.lang === 'tsx' ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const sourceFile = ts.createSourceFile('component.' + (block.lang || 'js'), block.content, ts.ScriptTarget.Latest, true, kind)
  const imports = []
  function visit(node) {
    let specifier
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0]
    if (specifier) {
      const point = sourceFile.getLineAndCharacterOfPosition(specifier.getStart(sourceFile))
      imports.push({ module: specifier.text, line: block.loc.start.line + point.line, column: point.character + 1 })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return imports
}

function isVendorImport(module) {
  return vendorImportPrefixes.some(prefix => module === prefix || module.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
}

function compareDebt(a, b) {
  return a.file.localeCompare(b.file)
    || a.location.line - b.location.line
    || a.location.column - b.location.column
    || a.kind.localeCompare(b.kind)
    || a.evidence.localeCompare(b.evidence)
}

function debtKey(item) {
  return `${item.file}:${item.location?.line}:${item.location?.column}:${item.kind}:${item.evidence}`
}

function makeDebt(file, kind, evidence, loc, target) {
  return {
    file,
    kind,
    evidence,
    location: loc,
    target,
    ownerTask: debtOwnerTask,
    status: 'open',
  }
}

export async function auditSuitTemplates({ root = defaultRoot } = {}) {
  const { suits, files } = await discoverSuitVueFiles(root)
  const relativeFiles = files.map(file => slash(path.relative(root, file)))
  const localNamesBySuit = new Map()
  for (const suit of suits) {
    const prefix = `apps/${suit}/app/components/`
    localNamesBySuit.set(suit, new Set(relativeFiles
      .filter(file => file.startsWith(prefix))
      .map(file => path.basename(file, '.vue'))))
  }

  const debt = []
  const parseFailures = []
  for (let index = 0; index < files.length; index++) {
    const absolute = files[index]
    const file = relativeFiles[index]
    const suit = file.split('/')[1]
    const source = await readFile(absolute, 'utf8')
    const { descriptor, errors } = parse(source, { filename: file })
    for (const error of errors) parseFailures.push(`${file}: ${typeof error === 'string' ? error : error.message}`)

    if (file.includes('/app/components/')) {
      debt.push(makeDebt(file, 'app-local-component-file', path.basename(file), { line: 1, column: 1 }, 'packages/ui Bs component; product logic in route/composable/store/helper'))
    }

    if (descriptor.template?.ast) {
      const localNames = localNamesBySuit.get(suit) || new Set()
      function visit(node) {
        if (node.type === 1) {
          const kind = tagKind(node, localNames)
          if (kind) debt.push(makeDebt(file, kind, `<${node.tag}>`, location(node.loc), targetForTag(node.tag, kind)))
          for (const prop of node.props) {
            const attribute = presentationAttribute(prop)
            if (!attribute) continue
            const attributeKind = attribute === 'v-html' ? 'raw-html-directive' : 'presentation-attribute'
            const target = attribute === 'v-html'
              ? 'packages/ui typed content component or slot contract'
              : 'packages/ui semantic variant/tone/size/density/layout/spacing prop'
            debt.push(makeDebt(file, attributeKind, prop.loc.source, location(prop.loc), target))
          }
        }
        for (const child of node.children || []) visit(child)
        if (node.type === 9) for (const branch of node.branches) visit(branch)
      }
      visit(descriptor.template.ast)
    }

    for (const style of descriptor.styles) {
      const before = source.slice(0, style.loc.start.offset)
      const openOffset = before.lastIndexOf('<style')
      const openLine = source.slice(0, openOffset).split('\n').length
      const open = source.slice(openOffset, source.indexOf('>', openOffset) + 1)
      debt.push(makeDebt(file, 'style-block', open, { line: openLine, column: 1 }, 'packages/ui shared styles and semantic component props'))
    }

    for (const block of [descriptor.script, descriptor.scriptSetup]) for (const item of importSpecifiers(block)) {
      if (isVendorImport(item.module)) debt.push(makeDebt(file, 'ui-vendor-import', item.module, { line: item.line, column: item.column }, 'packages/ui or packages/ux vendor adapter'))
    }
  }
  return { suits, files: relativeFiles, debt: debt.sort(compareDebt), parseFailures }
}

export async function validateSuitTemplateBoundaries({ root = defaultRoot, manifestPath = defaultDebtManifest, strict = false } = {}) {
  const audit = await auditSuitTemplates({ root })
  const failures = [...audit.parseFailures]
  if (strict) {
    if (!audit.suits.length || !audit.files.length) failures.push('Strict Suit UI boundary requires a discovered Suit with Vue files')
    for (const item of audit.debt) failures.push(`${debtKey(item)}: forbidden in strict mode`)
    return { ...audit, failures }
  }
  let manifest
  try { manifest = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8')) }
  catch (error) { return { ...audit, failures: [...failures, `${manifestPath}: ${error.message}`] } }

  if (manifest.schemaVersion !== 1) failures.push(`${manifestPath}: schemaVersion must be 1`)
  if (manifest.mode !== 'migration') failures.push(`${manifestPath}: mode must be "migration"`)
  if (!manifest.auditedReference || typeof manifest.auditedReference.branch !== 'string' || typeof manifest.auditedReference.commit !== 'string') {
    failures.push(`${manifestPath}: auditedReference requires branch and commit`)
  }
  if (!Array.isArray(manifest.violations)) failures.push(`${manifestPath}: violations must be an array`)
  const recorded = Array.isArray(manifest.violations) ? manifest.violations : []
  const actualByKey = new Map(audit.debt.map(item => [debtKey(item), item]))
  const recordedByKey = new Map()
  for (const item of recorded) {
    if (!item || typeof item !== 'object') { failures.push(`${manifestPath}: every violation must be an object`); continue }
    const key = debtKey(item)
    if (recordedByKey.has(key)) failures.push(`${manifestPath}: duplicate violation ${key}`)
    recordedByKey.set(key, item)
    for (const field of ['file', 'kind', 'evidence', 'target', 'ownerTask', 'status']) {
      if (typeof item[field] !== 'string' || !item[field]) failures.push(`${manifestPath}: ${key} requires ${field}`)
    }
    if (!item.location || !Number.isInteger(item.location.line) || !Number.isInteger(item.location.column)) failures.push(`${manifestPath}: ${key} requires an exact location`)
    if (item.ownerTask !== debtOwnerTask) failures.push(`${manifestPath}: ${key} ownerTask must be ${debtOwnerTask}`)
    if (item.status !== 'open') failures.push(`${manifestPath}: ${key} migration status must be open`)
  }
  for (const [key] of actualByKey) if (!recordedByKey.has(key)) failures.push(`${key}: new unrecorded Suit UI boundary violation`)
  for (const [key] of recordedByKey) if (!actualByKey.has(key)) failures.push(`${manifestPath}: stale Suit UI boundary debt ${key}`)
  for (const [key, actual] of actualByKey) {
    const item = recordedByKey.get(key)
    if (!item) continue
    for (const field of ['target', 'ownerTask', 'status']) if (item[field] !== actual[field]) failures.push(`${manifestPath}: ${key} has incorrect ${field}`)
  }
  return { ...audit, manifest, failures }
}

export async function writeSuitTemplateDebt({ root = defaultRoot, manifestPath = defaultDebtManifest, branch, commit } = {}) {
  if (!branch || !commit) throw new Error('--write requires --branch and --commit')
  const audit = await auditSuitTemplates({ root })
  if (audit.parseFailures.length) throw new Error(audit.parseFailures.join('\n'))
  const manifest = {
    schemaVersion: 1,
    mode: 'migration',
    auditedReference: { branch, commit },
    scope: 'apps/*-suit/app/**/*.vue',
    owner: 'packages/ui',
    violations: audit.debt,
  }
  await writeFile(path.join(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`)
  return { ...audit, manifest }
}

async function main() {
  const args = process.argv.slice(2)
  const option = name => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const root = option('--root') ? path.resolve(option('--root')) : defaultRoot
  const manifestPath = option('--manifest') || defaultDebtManifest
  if (args.includes('--write')) {
    const result = await writeSuitTemplateDebt({ root, manifestPath, branch: option('--branch'), commit: option('--commit') })
    console.log(`Recorded ${result.debt.length} exact Suit UI boundary violations across ${result.files.length} Vue files in ${result.suits.length} dynamically discovered Suits.`)
    return
  }
  const result = await validateSuitTemplateBoundaries({ root, manifestPath, strict: args.includes('--strict') })
  if (result.failures.length) {
    console.error(result.failures.join('\n'))
    process.exitCode = 1
  } else {
    console.log(args.includes('--strict')
      ? `Suit UI boundary passes in strict mode: ${result.files.length} Vue files in ${result.suits.length} dynamically discovered Suits; zero violations.`
      : `Suit UI boundary passes in migration mode: ${result.debt.length} recorded violations across ${result.files.length} Vue files in ${result.suits.length} dynamically discovered Suits; no new or stale debt.`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main()
