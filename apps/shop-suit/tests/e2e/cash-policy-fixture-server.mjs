// Disposable verifier transport for authenticated Nuxt SSR and browser reloads.
// Synthetic identity/data only; never forwards requests to a Supabase project.
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const userId='00000000-0000-4000-8000-000000000001'
const user={id:userId,email:'pilot@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}
export async function fixtureResponse(url,authorization,request){
 let claims
 try{const token=String(authorization??'').replace(/^Bearer /,'');if(!token.endsWith('.test'))throw Error('not synthetic');claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'))}catch{return {status:401,data:{message:'Synthetic fixture session required'}}}
 if(claims.sub!==userId)return {status:401,data:{message:'Synthetic fixture identity required'}}
 if(url.pathname==='/auth/v1/user')return {status:200,data:user}
 const port=Number(claims.fixture_port)
 if(!Number.isInteger(port)||port<1024||port>65535||[4326,46421].includes(port))return {status:401,data:{message:'Synthetic fixture transport required'}}
 const body=[];for await(const chunk of request)body.push(chunk)
 const response=await fetch('http://127.0.0.1:'+port+url.pathname+url.search,{method:request.method,headers:{'content-type':'application/json'},body:['GET','HEAD'].includes(request.method)?undefined:Buffer.concat(body)})
 return {status:response.status,data:await response.json()}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const api=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:46421')
  const value=url.pathname==='/fixture-ready'?{status:200,data:{synthetic:true}}:await fixtureResponse(url,req.headers.authorization,req)
  res.writeHead(value.status,{'content-type':'application/json'});res.end(JSON.stringify(value.data))
 })
 api.listen(46421,'127.0.0.1',()=>{
  const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.output/server/index.mjs')
  const child=spawn(process.execPath,[app],{stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',PORT:'4326',NUXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:46421',SUPABASE_URL:'http://127.0.0.1:46421'}})
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);api.close()})
  child.on('exit',code=>{api.close();process.exitCode=code??1})
 })
}
