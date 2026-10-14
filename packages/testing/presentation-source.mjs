import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

/** Follow the actual shared component tree when asserting presentation ownership. */
export async function readPresentationTree(root, sourcePath) {
  const manifest = JSON.parse(await readFile(path.join(root, 'packages/ui/package.json'), 'utf8'))
  const components = new Map(Object.values(manifest.exports).filter(value => typeof value === 'string' && value.endsWith('.vue')).map(value => [path.basename(value, '.vue'), path.join(root, 'packages/ui', value)]))
  const visited = new Set()
  async function visit(file) {
    if (visited.has(file)) return ''
    visited.add(file)
    const source = await readFile(file, 'utf8')
    const { descriptor, errors } = parse(source, { filename: file })
    if (errors.length) throw new Error(`Invalid presentation source: ${file}`)
    const children = new Set([...descriptor.template?.content.matchAll(/<(Bs[A-Z]\w*)\b/g) ?? []].map(match => components.get(match[1])).filter(Boolean))
    return [source, ...await Promise.all([...children].map(visit))].join('\n')
  }
  return visit(path.resolve(root, sourcePath))
}
