/** Isolated real organism + input/field primitives, native button fixture.
 * No Nuxt server, Auth, provider, network request or production data. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { parse, compileScript } from '@vue/compiler-sfc'
import ts from 'typescript'
import { chromium } from '@playwright/test'
const require=createRequire(import.meta.url)
const root=new URL('../../../../',import.meta.url)
async function component(path,name,globals=''){
 const source=await readFile(new URL(path,root),'utf8')
 const {descriptor}=parse(source,{filename:path})
 const compiled=compileScript(descriptor,{id:name,inlineTemplate:true})
 let code=ts.transpileModule(compiled.content,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 code=code.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']vue["'];?/g,(_,bindings)=>`const {${bindings.replace(/\s+as\s+/g,':')}} = Vue;`)
 code=code.replace('export default',`window.${name} =`)
 return `{${globals}\n${code}}`
}
test('real email component shows exact preview and allows only separate single approval',async()=>{
 const browser=await chromium.launch({headless:true})
 try{
 const page=await browser.newPage();const external=[];const errors=[]
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{external.push(route.request().url());return route.abort()})
 await page.setContent('<div id="app"></div>')
 await page.addScriptTag({content:await readFile(require.resolve('vue/dist/vue.global.js'),'utf8')})
 for(const [path,name,globals] of [
  ['packages/ui/src/atoms/BsInput.vue','Input','const {ref}=Vue;'],
  ['packages/ui/src/atoms/BsTextarea.vue','Textarea',''],
  ['packages/ui/src/molecules/BsField.vue','Field','const {computed,useId}=Vue;'],
  ['packages/ui/src/organisms/BsHqEmailConnectionTest.vue','EmailTest',''],
 ])await page.addScriptTag({content:await component(path,name,globals)})
 await page.addScriptTag({content:`
 window.commands=[];window.state=Vue.reactive({pending:false,readiness:null,test:null,message:'',approvalAvailable:false});
 const app=Vue.createApp({render(){return Vue.h(window.EmailTest,{state:window.state,onCommand(command){window.commands.push(command);window.state.pending=true}})}});
 app.component('BsInput',window.Input);app.component('BsTextarea',window.Textarea);app.component('BsField',window.Field);
 app.component('BsButton',{inheritAttrs:false,setup(_,{attrs,slots}){return()=>Vue.h('button',attrs,slots.default?.())}});app.mount('#app');`})
 const recipient=page.getByRole('textbox',{name:'Exact test recipient',exact:true})
 assert.equal(await recipient.inputValue(),'')
 assert.equal(await page.getByRole('button',{name:'Prepare preview only',exact:true}).isDisabled(),true)
 await recipient.fill('fixture@example.invalid');await page.getByRole('textbox',{name:'Exact subject',exact:true}).fill('Exact subject')
 await page.getByRole('textbox',{name:'Exact plain-text message',exact:true}).fill('Hello\nمرحبا <script>not executed</script>')
 await page.getByRole('button',{name:'Prepare preview only',exact:true}).click()
 assert.equal(await page.getByRole('button',{name:'Prepare preview only',exact:true}).isDisabled(),true)
 assert.equal(await page.getByRole('button',{name:'Approve this exact test email',exact:true}).count(),0)
 await page.evaluate(()=>{const c=window.commands[0];window.state.pending=false;window.state.approvalAvailable=true;window.state.test={id:'11111111-1111-4111-8111-111111111111',sender:'Shop Suit Team <hello@shop.building-suit.com>',recipient:c.recipient,subject:c.subject,body:c.body,digest:'a'.repeat(64),state:'prepared',expiresAt:'2030-01-01T00:00:00Z',providerAccepted:false}})
 const preview=page.getByRole('region',{name:'Exact email approval preview',exact:true})
 assert.match(await preview.innerText(),/fixture@example.invalid/);assert.match(await preview.innerText(),/<script>not executed<\/script>/)
 assert.match(await preview.innerText(),/wakes the existing Oracle worker/)
 const approve=page.getByRole('button',{name:'Approve this exact test email',exact:true});await approve.click()
 assert.equal(await approve.isDisabled(),true)
 // A second synthetic click also cannot emit through the component pending guard.
 await approve.dispatchEvent('click')
 const commands=await page.evaluate(()=>window.commands)
 assert.equal(commands.length,2);assert.deepEqual(commands[1],{action:'decide',id:'11111111-1111-4111-8111-111111111111',digest:'a'.repeat(64),approve:true})
 assert.deepEqual(errors,[]);assert.deepEqual(external,[])
 }finally{await browser.close()}
})
