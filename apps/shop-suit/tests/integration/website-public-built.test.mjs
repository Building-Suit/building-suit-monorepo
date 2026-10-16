import assert from 'node:assert/strict'
import test from 'node:test'
import {request as httpRequest,createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {showcase} from '../fixtures/public-website.mjs'
test('two public hosts render isolated SSR, SEO and contact actions; unpublish fails closed and inquiries use authority',async()=>{
 let published=true;const calls=[],inquiries=[]
 const backend=createServer(async(req,res)=>{
  let body='';for await(const part of req)body+=part
  const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1);calls.push({name,args,headers:req.headers})
  res.setHeader('Content-Type','application/json')
  if(!['alpha-tools','beta-tools'].includes(args.p_slug)||!published){res.end('null');return}
  if(name==='shop_website_host_resolve')res.end(JSON.stringify({canonicalSlug:args.p_slug,isAlias:false}))
  else if(name==='shop_website_showcase')res.end(JSON.stringify(showcase(args.p_slug)))
  else if(name==='shop_website_inquiry_submit'){inquiries.push(args);res.end('{"ok":true}')}
  else{res.statusCode=500;res.end('{}')}
 });backend.listen(0,'127.0.0.1');await once(backend,'listening')
 const port=4388,child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:['ignore','ignore','pipe'],env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NUXT_PUBLIC_APP_URL:'https://shop.building-suit.com',NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key'}})
 let error='';child.stderr.on('data',v=>error+=v)
 const request=(host,path='/',body,extra={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port,path,method:body===undefined?'GET':'POST',headers:{host:`${host}.shops.building-suit.com`,...(body===undefined?{}:{origin:`https://${host}.shops.building-suit.com`,'content-type':'application/json'}),...extra}},res=>{const chunks=[];res.on('data',v=>chunks.push(v));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})))});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body))})
 try{
  const deadline=Date.now()+30000;for(;;){try{await request('unknown-shop');break}catch{assert.ok(Date.now()<deadline,error);await new Promise(r=>setTimeout(r,100))}}
  for(const [slug,own,other]of[['alpha-tools','Alpha Tools','Beta Services'],['beta-tools','Beta Services','Alpha Tools']]){
   const response=await request(slug,'/?lang=en',undefined,{cookie:'private-auth=PRIVATE','authorization':'Bearer PRIVATE','x-shop-id':'FOREIGN','x-forwarded-host':'shop.building-suit.com'})
   assert.equal(response.status,200,error);const html=await response.text()
   assert.ok(html.includes(own));assert.ok(!html.includes(other));assert.ok(!html.includes('PRIVATE'));assert.ok(html.includes('lang="en"'));assert.ok(html.includes('dir="ltr"'))
   assert.ok(html.includes(`https://${slug}.shops.building-suit.com/?lang=en`));assert.ok(html.includes('property="og:title"'));assert.ok(html.includes('Public repair specialists'))
   if(slug==='alpha-tools'){assert.ok(html.includes('tel:+201000000002'));assert.ok(!html.includes('wa.me/'));assert.ok(!html.includes('mailto:'));assert.ok(!html.includes('Beta street'));assert.ok(!html.includes('Public consultation'))}
   else{assert.ok(html.includes('https://wa.me/201000000003'));assert.ok(html.includes('mailto:public@beta.invalid'));assert.ok(!html.includes('tel:+201000000002'));assert.ok(!html.includes('Public repair</h3>'))}
   assert.ok(!html.includes('Add to cart'))
   assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('set-cookie'),null)
  }
  assert.ok(calls.every(c=>!c.headers.cookie&&!c.headers.authorization));assert.ok(calls.every(c=>['shop_website_host_resolve','shop_website_showcase'].includes(c.name)))
  const ar=await request('alpha-tools');assert.match(await ar.text(),/dir="rtl"/)
  const robots=await request('alpha-tools','/robots.txt');assert.match(await robots.text(),/Allow: \/\nSitemap: https:\/\/alpha-tools/)
  const sitemap=await request('alpha-tools','/sitemap.xml');assert.match(await sitemap.text(),/alpha-tools.shops.building-suit.com/)
  const form={name:'Visitor',contact:'v@example.invalid',message:'Please contact me',company:'',locale:'en'}
  assert.equal((await request('alpha-tools','/api/website/inquiries',form)).status,202)
  assert.equal(inquiries[0].p_slug,'alpha-tools');assert.equal(inquiries[0].p_name,'Visitor')
  assert.equal((await request('alpha-tools','/api/website/inquiries',{...form,shopId:'beta-tools'})).status,400)
  assert.equal((await request('alpha-tools','/api/website/inquiries',form,{origin:'https://beta-tools.shops.building-suit.com'})).status,403)
  assert.equal((await request('alpha-tools','/api/website/inquiries',{...form,message:'a'.repeat(13000)})).status,413)
  assert.equal((await request('alpha-tools','/api/website/inquiries',form)).status,202)
  assert.equal((await request('alpha-tools','/api/website/inquiries',form)).status,202)
  const limited=await request('alpha-tools','/api/website/inquiries',form);assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'600')
  published=false
  for(const path of ['/','/robots.txt','/sitemap.xml','/api/website/inquiries']){
   const response=await request('alpha-tools',path,path.includes('/api/')?form:undefined)
   assert.equal(response.status,404);assert.equal(await response.text(),'Not Found');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('cache-control'),'private, no-store')
  }
 }finally{child.kill('SIGTERM');backend.closeAllConnections();backend.close();await once(child,'exit')}
})
