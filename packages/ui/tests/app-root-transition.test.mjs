import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile}from'node:fs/promises'
import{stripTypeScriptTypes}from'node:module'
import{compileScript,parse}from'vue/compiler-sfc'
import{createRenderer,defineComponent,reactive,nextTick}from'vue'

test('auth transitions preserve their default and custom value while explicit false stays disabled across navigation',async()=>{
 const route=reactive({path:'/sign-in'}),{descriptor}=parse(await readFile(new URL('../src/templates/BsAppRoot.vue',import.meta.url),'utf8'))
 const source=stripTypeScriptTypes(compileScript(descriptor,{id:'root-transition',inlineTemplate:true}).content).replace(/from (['"])vue\1/g,`from '${import.meta.resolve('vue')}'`)
 globalThis.__rootTransitionRoute=route
 const code=`import{computed}from'${import.meta.resolve('vue')}';const route=globalThis.__rootTransitionRoute;const useRouter=()=>({currentRoute:{get value(){return route}}});${source}`
 const{default:Root}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);delete globalThis.__rootTransitionRoute
 const node=()=>({children:[],parent:null}),remove=child=>{if(child.parent)child.parent.children.splice(child.parent.children.indexOf(child),1);child.parent=null}
 const renderer=createRenderer({createElement:node,createText:node,createComment:node,setText(){},setElementText(){},patchProp(){},insert(child,parent,anchor){remove(child);const at=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(at<0?parent.children.length:at,0,child);child.parent=parent},remove,parentNode:child=>child.parent,nextSibling:child=>child.parent?.children[child.parent.children.indexOf(child)+1]??null})
 const custom={name:'existing-product-transition',mode:'out-in'}
 for(const scenario of[{props:{},expected:{name:'bs-auth-route',mode:'out-in'}},{props:{layoutKey:'stable-session'},expected:false},{props:{pageTransition:false},expected:false},{props:{pageTransition:custom},expected:custom}]){
  route.path='/sign-in';let observed
  const app=renderer.createApp(Root,scenario.props)
  app.component('NuxtLayout',defineComponent({props:['name'],setup:(_,{slots})=>()=>slots.default?.()}))
  app.component('NuxtPage',defineComponent({props:['transition'],setup:props=>()=>{observed=props.transition;return null}}))
  for(const name of['BsConfirmHost','BsToastHost','BsPrivacyConsent','BsSectionSkeleton','NuxtRouteAnnouncer'])app.component(name,defineComponent({setup:()=>()=>null}))
  app.mount(node());assert.deepEqual(observed,scenario.expected)
  route.path='/account';await nextTick();assert.deepEqual(observed,scenario.props.pageTransition===custom?custom:false)
  route.path='/sign-in';await nextTick();assert.deepEqual(observed,scenario.expected)
  app.unmount()
 }
})
