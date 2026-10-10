import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))

// An explicit root lets verification generate a disposable workspace without registering a real app.
export async function generatePlatform({ slug, title = slug, dryRun = false, root = workspaceRoot }) {
  if (!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || !title?.trim()) {
    throw new Error('Usage: pnpm new:platform <lowercase-slug> "Product name" [--dry-run]')
  }
  const target = path.join(root, 'apps', slug)
  try { await access(target); throw new Error(`Refusing to overwrite ${target}`) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  // Apps own the Nuxt runtime; the shared layer owns presentation modules, fonts and vendors.
  const dependencies = Object.fromEntries(['nuxt', 'vue', 'vue-router'].map(name => [name, rootPackage.devDependencies[name]]))
  dependencies['@building-suit/nuxt-layer'] = 'workspace:*'
  const files = new Map([
    ['package.json', JSON.stringify({ name: `@building-suit/${slug}`, private: true, type: 'module', scripts: { dev: 'nuxt dev', build: 'nuxt build', prepare: 'nuxt prepare', typecheck: 'nuxt typecheck', lint: 'eslint .' }, dependencies, devDependencies: { typescript: rootPackage.devDependencies.typescript, 'vue-tsc': rootPackage.devDependencies['vue-tsc'] } }, null, 2) + '\n'],
    ['i18n/locales/en.json', JSON.stringify({ product: { name: title }, welcome: 'Welcome', description: 'Configure this product’s content and authorized features.', feature: 'Your workspace', featureBody: 'Shared Building Suit components and behavior.', workflow: 'Get started', workflowBody: 'Configure your product before connecting live services.' }, null, 2) + '\n'],
  ])
  async function templates(relative = '') {
    const directory = path.join(workspaceRoot, 'tooling/new-platform/templates', relative)
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(relative, entry.name)
      if (entry.isDirectory()) await templates(file)
      else files.set(file.replace(/\.template$/, ''), await readFile(path.join(directory, entry.name), 'utf8'))
    }
  }
  await templates()
  const arabic = JSON.parse(files.get('i18n/locales/ar.json'))
  arabic.product.name = title
  files.set('i18n/locales/ar.json', JSON.stringify(arabic, null, 2) + '\n')
  const inventory = [...files.keys()].map(file => `apps/${slug}/${file}`)
  if (!dryRun) {
    await mkdir(path.dirname(target), { recursive: true })
    await mkdir(target) // Exclusive creation; never overwrite an existing app.
    for (const [file, contents] of files) {
      await mkdir(path.dirname(path.join(target, file)), { recursive: true })
      await writeFile(path.join(target, file), contents, { flag: 'wx' })
    }
  }
  return inventory
}

async function main() {
  const [slug, title = slug, option, ...extra] = process.argv.slice(2)
  if ((option && option !== '--dry-run') || extra.length) throw new Error('Usage: pnpm new:platform <lowercase-slug> "Product name" [--dry-run]')
  const inventory = await generatePlatform({ slug, title, dryRun: option === '--dry-run' })
  console.log(option === '--dry-run' ? inventory.join('\n') : `Created apps/${slug}. Run pnpm install, pnpm setup, then pnpm --filter @building-suit/${slug} dev. Read its README before adding backend access.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { await main() }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
