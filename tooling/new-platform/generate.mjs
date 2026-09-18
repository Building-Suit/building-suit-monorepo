import { mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../../', import.meta.url))
const [slug, title = slug, option] = process.argv.slice(2)
if (!slug || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) || !title?.trim() || (option && option !== '--dry-run')) {
  console.error('Usage: pnpm new:platform <lowercase-slug> "Product name" [--dry-run]')
  process.exit(1)
}
const target = path.join(root, 'apps', slug)
try { await access(target); throw new Error(`Refusing to overwrite ${target}`) }
catch (error) { if (error.code !== 'ENOENT') throw error }
const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const reference = JSON.parse(await readFile(path.join(root, 'apps/building-suit-docs/package.json'), 'utf8'))
const dependencies = Object.fromEntries(Object.entries(reference.dependencies).filter(([name]) => !['@nuxtjs/supabase', 'zod'].includes(name)))
const files = new Map([['package.json', JSON.stringify({ name: `@building-suit/${slug}`, private: true, type: 'module', scripts: { dev: 'nuxt dev', build: 'nuxt build', prepare: 'nuxt prepare', typecheck: 'nuxt typecheck', lint: 'eslint .' }, dependencies, devDependencies: { typescript: rootPackage.devDependencies.typescript, 'vue-tsc': rootPackage.devDependencies['vue-tsc'] } }, null, 2) + '\n'], ['i18n/locales/en.json', JSON.stringify({ product: { name: title }, welcome: 'Welcome', description: 'Configure this product’s content and authorized features.', feature: 'Your workspace', featureBody: 'Shared Building Suit components and behavior.', workflow: 'Get started', workflowBody: 'Configure your product before connecting live services.' }, null, 2) + '\n']])
async function templates(relative = '') {
  const directory = path.join(root, 'tooling/new-platform/templates', relative)
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
if (option === '--dry-run') console.log([...files.keys()].map(file => `apps/${slug}/${file}`).join('\n'))
else {
  await mkdir(target) // Exclusive creation; never overwrite an existing app.
  for (const [file, contents] of files) {
    await mkdir(path.dirname(path.join(target, file)), { recursive: true })
    await writeFile(path.join(target, file), contents, { flag: 'wx' })
  }
  console.log(`Created apps/${slug}. Run pnpm install, pnpm setup, then pnpm --filter @building-suit/${slug} dev. Read its README before adding backend access.`)
}
