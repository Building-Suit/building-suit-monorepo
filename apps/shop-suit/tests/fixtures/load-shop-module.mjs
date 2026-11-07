import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import * as vue from 'vue'
import * as pinia from 'pinia'
import * as colada from '@pinia/colada'

/** Run actual Shop modules with only Nuxt/provider edges supplied by each test. */
export function shopModuleLoader(globals) {
 const root = fileURLToPath(new URL('../../app/',import.meta.url)), modules = new Map()
 const nativeRequire = createRequire(import.meta.url)
 function load(file) {
  let path = resolve(root,file)
  if (!existsSync(path)) path += '.ts'
  if (modules.has(path)) return modules.get(path).exports
  const module = { exports: {} };modules.set(path,module)
  const source = readFileSync(path,'utf8').replaceAll('import.meta.client','false').replaceAll('import.meta.server','true')
  const code = ts.transpileModule(source,{ compilerOptions:{ module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022 } }).outputText
  const localRequire = name => {
   if (name === 'vue') return vue
   if (name === 'pinia') return pinia
   if (name === '@pinia/colada') return colada
   if (name === '#imports') return globals
   if (name.startsWith('~/')) return load(name.slice(2))
   if (name.startsWith('.')) return load(resolve(dirname(path),name))
   return nativeRequire(name)
  }
  new Function('module','exports','require',...Object.keys(globals),code)(module,module.exports,localRequire,...Object.values(globals))
  return module.exports
 }
 return load
}
