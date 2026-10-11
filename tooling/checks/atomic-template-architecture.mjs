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
          if (module === 'vue' && renderCalls.has(binding.propertyName?.text ?? binding.name.text)) renderBindings.add(binding.name.text)
        }
        if (module === 'vue' && clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) namespaces.add(clause.namedBindings.name.text)
      }
      const localBindings = new Set()
      function discoverBindings(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          localBindings.add(node.name.text)
          const value = node.initializer
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
          if ((prop.type === 6 && ['class', 'style'].includes(prop.name)) || (prop.type === 7 && ['html', 'slot'].includes(prop.name))) failures.push(`${file}: presentation/slot recipe must be owned by its template`)
        }
        for (const child of node.children ?? []) inspectTemplate(child)
      }
      inspectTemplate(nodes[0])
      if (descriptor.styles.length) failures.push(`${file}: route styles must be owned by packages/ui`)
    }
  }
  for (const entry of registry.entries.filter(entry => entry.kind === 'route')) if (!actualRoutes.includes(entry.source)) failures.push(`${entry.source}: stale registered route`)
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
