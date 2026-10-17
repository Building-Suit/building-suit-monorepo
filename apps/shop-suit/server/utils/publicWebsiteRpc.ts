/** Explicit anonymous client: never forward incoming cookies, user JWTs or tenant headers. */
export async function publicWebsiteRpc(config:{url:string;key:string},name:string,args:Record<string,unknown>):Promise<unknown> {
 const url=new URL(config.url)
 if(url.username||url.password||url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('PUBLIC_BACKEND_UNAVAILABLE')
 let legacy=false
 if(config.key.startsWith('eyJ')){
  const payload=JSON.parse(Buffer.from(config.key.split('.')[1]??'','base64url').toString())
  if(payload.role!=='anon')throw Error('PUBLIC_BACKEND_UNAVAILABLE');legacy=true
 }else if(!config.key.startsWith('sb_publishable_')&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('PUBLIC_BACKEND_UNAVAILABLE')
 const response=await fetch(new URL(`/rest/v1/rpc/${name}`,url),{method:'POST',headers:{apikey:config.key,...(legacy?{Authorization:`Bearer ${config.key}`} : {}),'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000),cache:'no-store'})
 if(!response.ok){const body=await response.json().catch(()=>({}));const error=new Error('PUBLIC_BACKEND_UNAVAILABLE') as Error&{code?:string};error.code=typeof body.code==='string'?body.code:undefined;throw error}
 return response.json()
}
