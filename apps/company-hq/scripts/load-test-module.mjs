import ts from 'typescript'
import { readFile } from 'node:fs/promises'
const cache = new Map()
export async function moduleUrl(path) {
  path = new URL(path, import.meta.url)
  if (cache.has(path.href)) return cache.get(path.href)
  let code = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const match of [...code.matchAll(/from ['"](.\/[^'"]+)['"]/g)]) {
    const relative = match[1]
    const url = await moduleUrl(new URL(relative + (relative.endsWith('.ts') ? '' : '.ts'), path))
    code = code.replaceAll(`'${relative}'`, `'${url}'`).replaceAll(`"${relative}"`, `"${url}"`)
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  cache.set(path.href, url); return url
}
export const load = async path => import(await moduleUrl(path))
