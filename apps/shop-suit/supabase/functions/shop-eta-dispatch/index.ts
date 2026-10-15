import { authorizeServer, env } from '../_shared/xpay-runtime.ts'
import { createEtaClient, createEtaDispatcher } from '../_shared/eta-worker.mjs'
const client = createEtaClient({})
async function rpc(name: string, args: unknown) {
 if (!['shop_eta_claim','shop_eta_prepare','shop_eta_transition'].includes(name)) throw new Error('ETA_RPC_DENIED')
 const key = env('SUPABASE_SERVICE_ROLE_KEY') || ''
 const url = new URL(env('SUPABASE_URL') || '')
 const response = await fetch(`${url.origin}/rest/v1/rpc/${name}`, { method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(args) })
 if (!response.ok) throw new Error('ETA_RPC_FAILED')
 return response.json()
}
const dispatch = createEtaDispatcher({rpc, client, configuration: (shopId: string, serial: string) => {
 try {
  const configured = JSON.parse(env('SHOP_ETA_PREPRODUCTION_POS') || '[]')
  return configured.find((entry: {shopId: string; deviceSerialNumber: string})=>entry.shopId === shopId && entry.deviceSerialNumber === serial)
 } catch { return null }
}})
Deno.serve(async (request: Request) => {
 if (request.method !== 'POST' || !await authorizeServer(request.headers.get('authorization'))) return new Response(null,{status:403})
 if (env('SHOP_ETA_DISPATCH_ENABLED') !== 'true') return Response.json({state:'disabled'},{status:503})
 try { return Response.json(await dispatch()) } catch { return Response.json({state:'retry_later'},{status:503}) }
})
