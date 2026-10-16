// Loopback-only synthetic public API, never a hosted project or customer publication.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {showcase} from '../fixtures/public-website.mjs'
const api=createServer(async(req,res)=>{
 let body='';for await(const part of req)body+=part
 const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1)
 res.setHeader('content-type','application/json')
 if(!['alpha-tools','beta-tools','paged-tools'].includes(args.p_slug)){res.end('null');return}
 if(name==='shop_website_host_resolve')res.end(JSON.stringify({canonicalSlug:args.p_slug,isAlias:false}))
 else if(name==='shop_website_showcase'){
  const value=showcase(args.p_slug)
  if(args.p_slug==='paged-tools'){
   value.profile.publicName='Paged Tools'
   value.catalog.page=Number(args.p_page??1);value.catalog.total=21
   value.catalog.items=Array.from({length:value.catalog.page===1?20:1},(_,i)=>({...value.catalog.items[0],publicId:`page-${value.catalog.page}-${i}`,name:value.catalog.page===1?`Page one service ${i+1}`:'Page two repair'}))
  }
  res.end(JSON.stringify(value))
 }
 else if(name==='shop_website_inquiry_submit')res.end('{"ok":true}')
 else{res.statusCode=404;res.end('{}')}
})
api.listen(46921,'127.0.0.1',()=>{
 const child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:'4329',NUXT_PUBLIC_APP_URL:'http://127.0.0.1:4329',NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:46921',SUPABASE_URL:'http://127.0.0.1:46921',NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key'}})
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);api.close()})
 child.on('exit',code=>{api.close();process.exitCode=code??1})
})
