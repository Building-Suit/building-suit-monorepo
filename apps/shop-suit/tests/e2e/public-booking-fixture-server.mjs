// Loopback synthetic data only; no hosted database or customer publication.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {showcase} from '../fixtures/public-website.mjs'
import {createBookingFixture} from '../fixtures/public-booking.mjs'
const model=createBookingFixture(),port=process.env.BOOKING_TEST_PORT??'4337',apiPort=Number(process.env.BOOKING_TEST_API_PORT??46927)
const api=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const args=JSON.parse(body||'{}'),name=req.url.split('/').at(-1);res.setHeader('content-type','application/json');
 if(req.url==='/control'){res.end(JSON.stringify(model.rpc('control',args)));return}
 if(name==='shop_website_host_resolve'){res.end(JSON.stringify(['alpha-tools','beta-tools','alpha-alias','disabled-tools'].includes(args.p_slug)?{canonicalSlug:args.p_slug==='alpha-alias'?'alpha-tools':args.p_slug,isAlias:args.p_slug==='alpha-alias'}:null));return}
 if(name==='shop_website_showcase'){const value=showcase(args.p_slug);if(args.p_slug==='disabled-tools'){value.profile.canonicalSlug='disabled-tools';value.profile.canonicalUrl='https://disabled-tools.shops.building-suit.com'}res.end(JSON.stringify(value));return}
 res.end(JSON.stringify(model.rpc(name,args)))
})
api.listen(apiPort,'127.0.0.1',()=>{const child=spawn(process.execPath,['apps/shop-suit/.output/server/index.mjs'],{stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:port,NUXT_PUBLIC_APP_URL:`http://127.0.0.1:${port}`,NUXT_PUBLIC_APP_ENVIRONMENT:'production',NUXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${apiPort}`,SUPABASE_URL:`http://127.0.0.1:${apiPort}`,NUXT_PUBLIC_SUPABASE_KEY:'local-fixture-publishable-key'}});for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);api.close()});child.on('exit',code=>{api.close();process.exitCode=code??1})})
