import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url))
async function walk(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(target))
    else result.push(target)
  }
  return result
}
const normalized = value => value.replaceAll(path.sep, '/')
const renderCalls = new Set(['h', 'createVNode', 'createElementVNode', 'createBlock', 'createElementBlock', 'defineComponent', 'defineAsyncComponent', 'resolveComponent', 'resolveDynamicComponent'])
export async function validateAtomicTemplateArchitecture({ root = defaultRoot } = {}) {
  const failures = []
  const registry = JSON.parse(await readFile(path.join(root, 'docs/shared/atomic-template-route-inventory.json'), 'utf8'))
  const ui = JSON.parse(await readFile(path.join(root, 'packages/ui/package.json'), 'utf8'))
  const templateOwners = new Map(Object.entries(ui.exports).filter(([, target]) => /^\.\/src\/templates\/Bs[A-Z]\w*\.vue$/.test(target)).map(([specifier, target]) => [path.basename(target, '.vue'), { specifier: `@building-suit/ui${specifier.slice(1)}`, source: `packages/ui/${target.slice(2)}` }]))
  const suits = (await readdir(path.join(root, 'apps'), { withFileTypes: true })).filter(entry => entry.isDirectory() && entry.name.endsWith('-suit')).map(entry => entry.name)
  // Resolve callable aliases across real source imports and re-exports instead of
  // trusting the identifier chosen by an adapter or presentation helper.
  const moduleAsts = new Map()
  async function sourceModule(from, specifier) {
    let target
    if (specifier.startsWith('.')) target = path.resolve(path.dirname(from), specifier)
    else if (/^(?:~|@)\//.test(specifier)) {
      const app = from.match(/^(.*\/apps\/[^/]+)\/app\//)?.[1]
      if (app) target = path.join(app, 'app', specifier.slice(2))
    } else if (specifier.startsWith('~~/')) {
      const app = from.match(/^(.*\/apps\/[^/]+)\/app\//)?.[1]
      if (app) target = path.join(app, specifier.slice(3))
    } else if (specifier.startsWith('@building-suit/')) {
      const [name, ...subpath] = specifier.slice('@building-suit/'.length).split('/')
      try {
        const manifest = JSON.parse(await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8'))
        const entry = manifest.exports?.[subpath.length ? `./${subpath.join('/')}` : '.']
        if (typeof entry === 'string') target = path.join(root, 'packages', name, entry)
      } catch { /* Unavailable modules still receive direct boundary checks. */ }
    }
    if (!target) return null
    for (const candidate of [target, ...['.ts', '.js', '.vue', '/index.ts', '/index.js'].map(extension => target + extension)]) {
      if (moduleAsts.has(candidate)) return { file: candidate, ast: moduleAsts.get(candidate) }
      try {
        const text = await readFile(candidate, 'utf8')
        const descriptor = candidate.endsWith('.vue') ? parse(text, { filename: candidate }).descriptor : null
        const source = descriptor ? [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n') : text
        const ast = ts.createSourceFile(candidate, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
        moduleAsts.set(candidate, ast)
        return { file: candidate, ast }
      } catch { /* Try the next supported source extension. */ }
    }
    return null
  }
  async function callableOrigin(from, specifier, exported, wanted, seen = new Set()) {
    if (wanted.has(exported) && ['vue', '#imports', 'nuxt/app', '#app'].includes(specifier)) return true
    const resolved = await sourceModule(from, specifier)
    if (!resolved) return false
    const key = `${resolved.file}:${exported}`
    if (seen.has(key)) return false
    seen.add(key)
    const { ast, file } = resolved
    const visitedLocals = new Set()
    async function localOrigin(name) {
      if (visitedLocals.has(name)) return false
      visitedLocals.add(name)
      for (const statement of ast.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && !statement.importClause?.isTypeOnly) {
          const clause = statement.importClause
          if (clause?.name?.text === name && await callableOrigin(file, statement.moduleSpecifier.text, 'default', wanted, seen)) return true
          if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const element of clause.namedBindings.elements) {
            if (!element.isTypeOnly && element.name.text === name && await callableOrigin(file, statement.moduleSpecifier.text, element.propertyName?.text ?? name, wanted, seen)) return true
          }
        }
        if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer && ts.isIdentifier(declaration.initializer) && declaration.initializer.text !== name) return localOrigin(declaration.initializer.text)
        }
      }
      return false
    }
    for (const statement of ast.statements) {
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly || element.name.text !== exported) continue
        const sourceName = element.propertyName?.text ?? element.name.text
        if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
          if (await callableOrigin(file, statement.moduleSpecifier.text, sourceName, wanted, seen)) return true
        } else if (await localOrigin(sourceName)) return true
      }
      if (!statement.exportClause && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && await callableOrigin(file, statement.moduleSpecifier.text, exported, wanted, seen)) return true
    }
    return localOrigin(exported)
  }
  const actualRoutes = []
  for (const suit of suits) {
    const files = await walk(path.join(root, 'apps', suit, 'app'))
    for (const absolute of files.filter(file => /\.(vue|ts|tsx|jsx|js)$/.test(file))) {
      const file = normalized(path.relative(root, absolute))
      const text = await readFile(absolute, 'utf8')
      if (file.includes('/app/components/')) failures.push(`${file}: Suit-local render components are forbidden`)
      const descriptor = file.endsWith('.vue') ? parse(text, { filename: file }).descriptor : undefined
      const script = descriptor ? [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n') : text
      const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, /\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const bindings = new Map()
      const renderBindings = new Set()
      const namespaces = new Set()
      for (const statement of ast.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.importClause?.isTypeOnly) continue
        const module = statement.moduleSpecifier.text
        const clause = statement.importClause
        if (clause?.name) bindings.set(clause.name.text, module)
        if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const binding of clause.namedBindings.elements) {
          if (binding.isTypeOnly) continue
          bindings.set(binding.name.text, module)
          if (await callableOrigin(absolute, module, binding.propertyName?.text ?? binding.name.text, renderCalls)) renderBindings.add(binding.name.text)
        }
        if (module === 'vue' && clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) namespaces.add(clause.namedBindings.name.text)
      }
      const localBindings = new Set()
      function discoverBindings(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          localBindings.add(node.name.text)
          const value = node.initializer
          const dynamic = value && ts.isAwaitExpression(value) ? value.expression : value
          if (dynamic && ts.isCallExpression(dynamic) && dynamic.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(dynamic.arguments[0]) && dynamic.arguments[0].text === 'vue') namespaces.add(node.name.text)
          if (value && ts.isIdentifier(value)) {
            if (renderBindings.has(value.text) || renderCalls.has(value.text)) renderBindings.add(node.name.text)
            if (namespaces.has(value.text)) namespaces.add(node.name.text)
          }
          if (value && ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression) && namespaces.has(value.expression.text) && renderCalls.has(value.name.text)) renderBindings.add(node.name.text)
        }
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) localBindings.add(node.name.text)
        ts.forEachChild(node, discoverBindings)
      }
      discoverBindings(ast)
      function inspect(node) {
        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) failures.push(`${file}: JSX rendering must be owned by packages/ui`)
        if (ts.isCallExpression(node)) {
          const expression = node.expression
          const direct = ts.isIdentifier(expression) && (renderBindings.has(expression.text) || renderCalls.has(expression.text))
          const namespace = ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && namespaces.has(expression.expression.text) && renderCalls.has(expression.name.text)
          const indexed = ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression) && namespaces.has(expression.expression.text) && ts.isStringLiteral(expression.argumentExpression) && renderCalls.has(expression.argumentExpression.text)
          if (direct || namespace || indexed) failures.push(`${file}: runtime render factory ${expression.getText(ast)} must be owned by packages/ui`)
        }
        ts.forEachChild(node, inspect)
      }
      inspect(ast)
      if (descriptor && (file.includes('/app/layouts/') || file.endsWith('/app/app.vue'))) {
        const entry = registry.entries.find(entry => entry.source === file)
        const roots = descriptor.template?.ast?.children.filter(node => node.type === 1) ?? []
        const owner = roots.length === 1 ? templateOwners.get(roots[0].tag) : undefined
        if (!entry?.destination || owner?.source !== entry.destination) failures.push(`${file}: root/layout must resolve to its registered shared template`)
        if (roots.length === 1) {
          if (localBindings.has(roots[0].tag) || (bindings.has(roots[0].tag) && bindings.get(roots[0].tag) !== owner?.specifier)) failures.push(`${file}: root/layout template name is shadowed`)
          const children = roots[0].children.filter(node => node.type === 1)
          if (children.length > 1 || children.some(node => node.tag !== 'slot' || node.props.length || node.children.length)) failures.push(`${file}: layout may expose only one direct unscoped route outlet`)
        }
        if (descriptor.styles.length) failures.push(`${file}: root/layout styles must be owned by packages/ui`)
      }
      if (!file.includes('/app/pages/') || !file.endsWith('.vue')) continue
      actualRoutes.push(file)
      const entry = registry.entries.find(entry => entry.source === file && entry.kind === 'route')
      if (!entry?.destination) { failures.push(`${file}: no complete registered page template`); continue }
      const nodes = descriptor.template?.ast?.children.filter(node => node.type === 1) ?? []
      if (nodes.length !== 1) { failures.push(`${file}: route must render exactly one shared page template`); continue }
      const owner = templateOwners.get(nodes[0].tag)
      if (!owner || owner.source !== entry.destination) failures.push(`${file}: root component does not resolve to its registered UI template`)
      if (!registry.pageTemplates?.includes(nodes[0].tag)) failures.push(`${file}: shell/frame component is not a complete page template`)
      if (localBindings.has(nodes[0].tag)) failures.push(`${file}: template name is shadowed by a local runtime declaration`)
      const importSource = bindings.get(nodes[0].tag)
      if (importSource && importSource !== owner?.specifier) failures.push(`${file}: template name is shadowed by ${importSource}`)
      if (!entry.purpose) failures.push(`${file}: route purpose is missing`)
      function inspectTemplate(node) {
        if (node.type === 1 && node !== nodes[0]) failures.push(`${file}: Suit-owned render composition ${node.tag} is forbidden`)
        for (const prop of node.props ?? []) {
          if ((prop.type === 6 && ['class', 'style'].includes(prop.name)) || (prop.type === 7 && (['html', 'slot'].includes(prop.name) || (prop.name === 'bind' && ['class', 'style'].includes(prop.arg?.content))))) failures.push(`${file}: presentation/slot recipe must be owned by its template`)
        }
        for (const child of node.children ?? []) inspectTemplate(child)
      }
      inspectTemplate(nodes[0])
      if (descriptor.styles.length) failures.push(`${file}: route styles must be owned by packages/ui`)
    }
  }
  for (const entry of registry.entries.filter(entry => entry.kind === 'route')) if (!actualRoutes.includes(entry.source)) failures.push(`${entry.source}: stale registered route`)
  const forbiddenUiCalls = new Set(['fetch', '$fetch', 'useFetch', 'useAsyncData', 'useSupabaseClient', 'useSupabaseUser', 'useTenant', 'useShop', 'useRuntimeConfig', 'useState'])
  for (const absolute of await walk(path.join(root, 'packages/ui/src'))) {
    if (!/\.(vue|ts|tsx|js|jsx)$/.test(absolute)) continue
    const file = normalized(path.relative(root, absolute))
    const text = await readFile(absolute, 'utf8')
    const descriptor = file.endsWith('.vue') ? parse(text, { filename: file }).descriptor : undefined
    const script = descriptor ? [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n') : text
    const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const forbiddenBindings = new Set(forbiddenUiCalls)
    for (const statement of ast.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
      const module = statement.moduleSpecifier.text
      if (/^(?:~|@)\/|(?:^|\/)apps\/|^@building-suit\/(?:auth|data-access)(?:\/|$)/.test(module)) failures.push(`${file}: UI may not import product/identity/data infrastructure ${module}`)
      const named = statement.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) for (const binding of named.elements) {
        if (await callableOrigin(absolute, module, binding.propertyName?.text ?? binding.name.text, forbiddenUiCalls)) forbiddenBindings.add(binding.name.text)
      }
    }
    const queryNamespaces = new Set()
    for (const statement of ast.statements) {
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamespaceImport(statement.importClause.namedBindings)) queryNamespaces.add(statement.importClause.namedBindings.name.text)
    }
    function discoverUiAliases(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const value = node.initializer
        if (ts.isIdentifier(value) && forbiddenBindings.has(value.text)) forbiddenBindings.add(node.name.text)
        if (ts.isPropertyAccessExpression(value) && forbiddenUiCalls.has(value.name.text)) forbiddenBindings.add(node.name.text)
      }
      ts.forEachChild(node, discoverUiAliases)
    }
    discoverUiAliases(ast)
    function inspectUi(node) {
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0]) && /^(?:~|@)\/|(?:^|\/)apps\/|^@building-suit\/(?:auth|data-access)(?:\/|$)/.test(node.arguments[0].text)) failures.push(`${file}: UI may not import product/identity/data infrastructure ${node.arguments[0].text}`)
        if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && queryNamespaces.has(node.expression.expression.text) && forbiddenUiCalls.has(node.expression.name.text)) failures.push(`${file}: product query/context behavior ${node.expression.getText(ast)} is forbidden in UI`)
        if (ts.isIdentifier(node.expression) && forbiddenBindings.has(node.expression.text)) failures.push(`${file}: product query/context behavior ${node.expression.text} is forbidden in UI`)
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'factory') failures.push(`${file}: product scope factories are forbidden in UI`)
      }
      if (registry.pageTemplates?.includes(path.basename(file, '.vue')) && (node.kind === ts.SyntaxKind.AnyKeyword || (ts.isTypeReferenceNode(node) && node.typeName.getText(ast) === 'Record' && node.typeArguments?.some(argument => argument.kind === ts.SyntaxKind.UnknownKeyword)))) failures.push(`${file}: page presentation contracts may not contain untyped state bags`)
      ts.forEachChild(node, inspectUi)
    }
    inspectUi(ast)
  }
  const purposes = new Map()
  for (const entry of registry.entries.filter(entry => entry.kind === 'route' && entry.purpose && entry.destination)) {
    const destination = purposes.get(entry.purpose)
    if (destination && destination !== entry.destination) failures.push(`${entry.source}: same-purpose routes must use ${destination}`)
    purposes.set(entry.purpose, entry.destination)
  }
  return { routes: actualRoutes.length, failures }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateAtomicTemplateArchitecture()
  if (result.failures.length) { console.error(result.failures.join('\n')); process.exitCode = 1 }
  else console.log(`Atomic template architecture passes for ${result.routes} routes with zero migration debt.`)
}
