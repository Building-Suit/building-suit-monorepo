import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir}from'node:os'
import path from'node:path'
import {discoverApplicationRoots}from'./application-roots.mjs'
import {validateSuitTemplateBoundaries}from'./suit-template-boundaries.mjs'
import {validateAtomicTemplateArchitecture}from'./atomic-template-architecture.mjs'
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'doctor-mobile-boundary-'));t.after(()=>rm(root,{recursive:true,force:true}))
 async function put(file,body){const p=path.join(root,file);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,typeof body==='string'?body:JSON.stringify(body))}
 const mobile='apps/example-suit/mobile/doctor'
 await put(mobile+'/package.json',{name:'@building-suit/example-mobile',buildingSuit:{kind:'mobile-client',product:'example-suit',renderer:'shared-web'}})
 for(const prefix of ['apps/example-suit',mobile])await put(prefix+'/app/pages/index.vue','<template><BsExamplePage/></template>')
 await put('packages/ui/package.json',{exports:{'./templates/BsExamplePage':'./src/templates/BsExamplePage.vue'}})
 await put('packages/ui/src/templates/BsExamplePage.vue','<template><div/></template>')
 await put('docs/shared/atomic-template-route-inventory.json',{registeredTemplates:{BsExamplePage:'packages/ui/src/templates/BsExamplePage.vue'},pageTemplates:['BsExamplePage'],entries:['apps/example-suit',mobile].map(prefix=>({source:prefix+'/app/pages/index.vue',kind:'route',destination:'packages/ui/src/templates/BsExamplePage.vue',purpose:'fixture'}))})
 return{root,put,mobile}
}
test('nested mobile is checked as an application without becoming a second Suit',async t=>{
 const{root}=await fixture(t);const discovered=await discoverApplicationRoots(root)
 assert.deepEqual(discovered.suits,['example-suit']);assert.deepEqual(discovered.applications,['example-suit','example-suit/mobile/doctor'])
 assert.deepEqual((await validateSuitTemplateBoundaries({root,strict:true})).failures,[])
 assert.deepEqual((await validateAtomicTemplateArchitecture({root})).failures,[])
})
test('nested native markup, CSS and local components cannot bypass strict ownership',async t=>{
 const{root,put,mobile}=await fixture(t)
 await put(mobile+'/app/pages/index.vue','<template><button>unsafe</button></template><style>.unsafe{color:red}</style>')
 await put(mobile+'/app/components/Local.vue','<template><BsExamplePage/></template>')
 const result=await validateSuitTemplateBoundaries({root,strict:true})
 assert.ok(result.failures.some(x=>x.includes('native-tag')));assert.ok(result.failures.some(x=>x.includes('style-block')));assert.ok(result.failures.some(x=>x.includes('app-local-component-file')))
})
test('nested aliases still resolve forbidden render factories',async t=>{
 const{root,put,mobile}=await fixture(t)
 await put(mobile+'/app/helpers.ts',"export {h as draw} from 'vue'")
 await put(mobile+'/app/pages/index.vue',"<script setup>import {draw} from '~/helpers';draw('div')</script><template><BsExamplePage/></template>")
 assert.ok((await validateAtomicTemplateArchitecture({root})).failures.some(x=>/render factory/.test(x)))
})
test('unregistered renderers fail closed instead of silently excluding mobile source',async t=>{
 const{root,put,mobile}=await fixture(t);await put(mobile+'/package.json',{buildingSuit:{kind:'mobile-client',product:'example-suit',renderer:'unreviewed'}})
 await assert.rejects(discoverApplicationRoots(root),/Unregistered mobile application boundary/)
})
