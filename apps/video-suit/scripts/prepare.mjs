import { readFile, readdir, mkdir, cp, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { validateProject } from '../scene/manifest.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const catalog = []
for (const id of await readdir(`${root}videos`)) {
  const p = validateProject(JSON.parse(await readFile(`${root}videos/${id}/project.json`, 'utf8')))
  if (p.id !== id) throw new Error('Project directory/id mismatch')
  catalog.push(p)
  await cp(`${root}videos/${id}`, `${root}public/videos/${id}`, { recursive: true })
}
await mkdir(`${root}public/brand`, { recursive: true })
for (const file of ['shop-suit-wordmark-light.svg','building-suit-logo-light.png']) await cp(`${root}../../packages/brand/assets/${file}`, `${root}public/brand/${file}`)
await cp(`${root}assets/shared`, `${root}public/shared`, { recursive: true })
await writeFile(`${root}public/catalog.json`, JSON.stringify(catalog))
await build({ entryPoints: [`${root}scene/player.mjs`], bundle: true, format: 'esm', outfile: `${root}public/player.js` })
