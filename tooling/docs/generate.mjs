import { readdir, readFile, mkdir, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'
import MarkdownIt from 'markdown-it'
const root = new URL('../../', import.meta.url).pathname
const sources = [ ['building-suit', 'apps/building-suit-docs/content/building-suit'], ['shared', 'docs/shared'], ['architecture', 'docs/architecture'] ]
const output = path.join(root, 'apps/building-suit-docs/app/generated')
const assets = path.join(root, 'apps/building-suit-docs/public/sources')
const md = new MarkdownIt({ html: false, linkify: true, typographer: false })
const documents = []
async function walk(base, prefix, rel = '') {
  let entries
  try { entries = await readdir(path.join(root, base, rel), { withFileTypes: true }) } catch (error) { if (error.code === 'ENOENT') return; throw error }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.posix.join(rel, entry.name)
    if (entry.isDirectory()) { await walk(base, prefix, file); continue }
    const id = `${prefix}/${file}`
    const destination = path.join(assets, id)
    await mkdir(path.dirname(destination), { recursive: true })
    await copyFile(path.join(root, base, file), destination)
    if (!file.endsWith('.md')) continue
    const source = await readFile(path.join(root, base, file), 'utf8')
    const tokens = md.parse(source, {})
    // Resolve local Markdown links to document routes and other assets to their preserved source path.
    const resolveUrl = url => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return url
      const [pathname, hash] = url.split('#')
      const target = path.posix.normalize(path.posix.join(prefix, path.posix.dirname(file), decodeURI(pathname)))
      if (target.startsWith('../')) return url
      return `${target.endsWith('.md') ? '/documents/' : '/sources/'}${target.split('/').map(encodeURIComponent).join('/')}${hash ? `#${hash}` : ''}`
    }
    const visit = tokens => tokens.forEach(token => {
      for (const key of ['href', 'src']) { const url = token.attrGet(key); if (url) token.attrSet(key, resolveUrl(url)) }
      if (token.children) visit(token.children)
    })
    visit(tokens)
    // Stable heading anchors make imported in-document links navigable.
    const seen = new Map()
    tokens.forEach((token, i) => { if (token.type !== 'heading_open') return; const title = tokens[i + 1]?.content || ''; const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-'); const n = seen.get(slug) || 0; seen.set(slug, n + 1); token.attrSet('id', n ? `${slug}-${n}` : slug) })
    documents.push({ id, group: prefix, title: source.match(/^#\s+(.+)$/m)?.[1] || file, sourcePath: `${base}/${file}`, html: md.renderer.render(tokens, md.options, {}), text: source, arabic: /(?:_AR|العربية)/i.test(file) })
  }
}
for (const [prefix, base] of sources) await walk(base, prefix)
await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'documents.json'), `${JSON.stringify(documents)}\n`)
console.log(`Generated documentation catalogue: ${documents.length} documents.`)
