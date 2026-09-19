import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const tokens = JSON.parse(await readFile(`${root}packages/design-tokens/tokens.json`, 'utf8'))
const kebab = value => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const flat = {}
function visit(value, path = []) {
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('_') || key.startsWith('$')) continue
    const next = [...path, key]
    if (item && typeof item === 'object' && 'value' in item) flat[next.join('.')] = item.value
    else if (item && typeof item === 'object') visit(item, next)
  }
}
visit(tokens)
const cssName = key => `--bs-${key.split('.').map(kebab).join('-')}`
const resolve = value => typeof value === 'string' ? value.replace(/\{([^}]+)\}/g, (_, key) => `var(${cssName(key)})`) : String(value)
const rootVars = Object.entries(flat).map(([key,value]) => `  ${cssName(key)}: ${typeof value === 'object' ? `${value.fontWeight} ${value.fontSize}/${value.lineHeight} var(--bs-font-latin)` : resolve(value)};`)
const alias = (name, path) => rootVars.push(`  --bs-${name}: var(${cssName(path)});`)
for (const group of ['brand','gold','gray','secondary','neutral','semantic','gradient']) {
  for (const key of Object.keys(tokens.color[group])) alias(['gold','gray','gradient'].includes(group)?`${group}-${key}`:kebab(key),`color.${group}.${key}`)
}
alias('midnight-bg','color.brand.midnightBackground')
alias('font-latin','typography.fontFamily.latin');alias('font-arabic','typography.fontFamily.arabic')
rootVars.push("  --bs-font-mono: ui-monospace, monospace;")
for (const k of Object.keys(tokens.typography.fontWeight)) alias(`weight-${k}`,`typography.fontWeight.${k}`)
for (const [k,{value:v}] of Object.entries(tokens.typography.scale)) {
  rootVars.push(`  --bs-type-${kebab(k)}-size: ${v.fontSize};`,`  --bs-type-${kebab(k)}-lh: ${v.lineHeight};`)
}
for (const k of Object.keys(tokens.spacing).filter(k=>!k.startsWith('_'))) alias(`space-${k}`,`spacing.${k}`)
for (let i=1;i<=3;i++) {alias(`shadow-${i}`,`shadow.elevation${i}`);alias(`shadow-${i}-dark`, `shadow.elevation${i}Dark`)}
rootVars.push('  --bs-button-height: 48px;','  --bs-input-height: 48px;','  --bs-tap-target-min: 44px;','  --bs-target-gap-min: 8px;','  --bs-motion-quick: 120ms ease;','  --bs-motion-default: 180ms ease;','  --bs-motion-enter: 200ms ease;','  --bs-focus-ring-width: 2px;','  --bs-focus-ring-offset: 2px;','  --bs-focus-ring-style: var(--bs-focus-ring-width) solid var(--bs-focus-ring);')
const roleNames={background:'bg',surface:'surface',surfaceMuted:'surface-muted',surfaceRaised:'surface-raised',text:'text',textMuted:'text-muted',textDisabled:'text-disabled',textOnPrimary:'text-on-primary',textOnAccent:'text-on-accent',border:'border',borderStrong:'border-strong',primary:'primary',primaryHover:'primary-hover',primaryPressed:'primary-pressed',accent:'accent',accentHover:'accent-hover',link:'link',focusRing:'focus-ring'}
function mode(name) {
 const vars=Object.entries(roleNames).map(([key,alias])=>`  --bs-${alias}: var(${cssName(`color.role.${name}.${key}`)});`)
 for(const status of ['success','warning','error','info']) {
  vars.push(`  --bs-status-${status}: var(${cssName(`color.semantic.${status}${name==='dark'?'Dark':''}`)});`,`  --bs-status-${status}-bg: var(${cssName(`color.semantic.${status}Bg${name==='dark'?'Dark':''}`)});`)
 }
 for(let i=1;i<=3;i++) vars.push(`  --bs-elevation-${i}: var(--bs-shadow-${i}${name==='dark'?'-dark':''});`)
 vars.push(`  --bs-scrim: ${flat[`component.modal.${name}.scrim`]};`)
 return vars.join('\n')
}
const output=`/* Generated from packages/design-tokens/tokens.json. Do not edit. */\n:root {\n${rootVars.join('\n')}\n${mode('light')}\n}\n:root[data-theme='dark'] {\n${mode('dark')}\n}\n@media (prefers-color-scheme: dark) {\n:root:not([data-theme='light']):not([data-theme='dark']) {\n${mode('dark')}\n}\n}\n@media (prefers-reduced-motion: reduce) { :root { --bs-motion-quick: 0ms; --bs-motion-default: 0ms; --bs-motion-enter: 0ms; } }\n`
const outputs={'tokens.css':output,'tokens.ts':`// Generated.\nexport const tokens = ${JSON.stringify(tokens,null,2)} as const\n`,'tailwind.colors.mjs':`// Generated semantic colors.\nexport default ${JSON.stringify(Object.fromEntries(Object.values(roleNames).map(k=>[k,`var(--bs-${k})`])),null,2)}\n`}
await mkdir(`${root}packages/design-tokens/generated`,{recursive:true})
for(const [name,content] of Object.entries(outputs)) {
 const path=`${root}packages/design-tokens/generated/${name}`
 if(process.argv.includes('--check')) {if(await readFile(path,'utf8')!==content) throw Error(`Token drift: ${name}`)}
 else await writeFile(path,content)
}
console.log(process.argv.includes('--check')?'Design token outputs match canonical source.':'Generated canonical token outputs.')
