import {readdir, readFile} from 'node:fs/promises'
import path from 'node:path'

// Mobile clients belong to an existing Suit; discovering them does not register
// another operational product. Every discovered web renderer gets the same checks.
export async function discoverApplicationRoots(root) {
  const suits = (await readdir(path.join(root, 'apps'), {withFileTypes: true}))
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit')).map(entry => entry.name).sort()
  const applications = [...suits]
  for (const suit of suits) {
    let entries
    try {entries = await readdir(path.join(root, 'apps', suit, 'mobile'), {withFileTypes: true})}
    catch (error) {if (error.code === 'ENOENT') continue; throw error}
    for (const entry of entries.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${suit}/mobile/${entry.name}`
      const manifest = JSON.parse(await readFile(path.join(root, 'apps', relative, 'package.json'), 'utf8'))
      if (manifest.buildingSuit?.kind !== 'mobile-client' || manifest.buildingSuit.product !== suit || manifest.buildingSuit.renderer !== 'shared-web') {
        throw new Error(`Unregistered mobile application boundary: apps/${relative}`)
      }
      applications.push(relative)
    }
  }
  return {suits, applications: applications.sort()}
}
