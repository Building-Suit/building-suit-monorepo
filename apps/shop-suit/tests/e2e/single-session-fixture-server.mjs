// Synthetic provider contract only. No upstream transport or hosted writes.
import { createServer } from 'node:http'
const sessions = new Map(), latest = new Map()
let sequence = 0
function user(account) {
  return { id: account === 'a' ? '00000000-0000-4000-8000-000000000101' : '00000000-0000-4000-8000-000000000102', email: `${account}@example.test`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
}
function session(account, id) {
  const claims = { sub: user(account).id, email: user(account).email, role: 'authenticated', session_id: id, exp: Math.floor(Date.now()/1000)+3600 }
  return { access_token: `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`, refresh_token: id, token_type: 'bearer', expires_in: 3600, user: user(account) }
}
createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-expose-headers', 'X-Supabase-Api-Version')
  res.setHeader('access-control-allow-headers', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  const send = (value, status=200) => { res.writeHead(status, {'content-type':'application/json','x-supabase-api-version':'2024-01-01'}); res.end(JSON.stringify(value)) }
  if(req.method==='OPTIONS') return send({})
  const url = new URL(req.url, 'http://127.0.0.1:4438')
  const chunks=[]; for await(const chunk of req) chunks.push(chunk)
  const input = JSON.parse(Buffer.concat(chunks).toString() || '{}')
  if(url.pathname==='/auth/v1/token') {
    if(url.searchParams.get('grant_type')==='password') {
      const account=input.email.startsWith('b@')?'b':'a', id=`synthetic-session-${++sequence}`
      sessions.set(id, account); latest.set(account,id)
      return send(session(account,id))
    }
    const account=sessions.get(input.refresh_token)
    if(!account || latest.get(account)!==input.refresh_token) return send({code:'session_not_found',message:'Session superseded by most recent sign in'},400)
    return send(session(account,input.refresh_token))
  }
  if(url.pathname==='/ready') return send({synthetic:true})
  let account
  try {
    const claims=JSON.parse(Buffer.from(req.headers.authorization.replace(/^Bearer /,'').split('.')[1],'base64url'))
    account=claims.sub===user('a').id?'a':'b'
  } catch { return send({message:'Session required'},401) }
  if(url.pathname==='/auth/v1/user') return send(user(account))
  if(url.pathname==='/auth/v1/logout') {
    if(url.searchParams.get('scope')!=='local') return send({message:'Only local logout is allowed in this verifier'},400)
    sessions.delete(input.refresh_token); return send({})
  }
  const shopId=`shop-${account}`
  if(url.pathname.endsWith('/portals')) return send({id:'shop-portal'})
  if(url.pathname.endsWith('/profiles')) return send({id:`profile-${account}`,status:'active',display_name:account,email_snapshot:user(account).email})
  if(url.pathname.endsWith('/shop_memberships')) return send([{id:`member-${account}`,shop_id:shopId,profile_id:`profile-${account}`,role:'owner',status:'active'}])
  if(url.pathname.endsWith('/shops')) return send([{id:shopId,name:`Private shop ${account}`,business_mode:'mixed',status:'active',created_at:'2026-10-01T00:00:00Z'}])
  if(url.pathname.endsWith('/rpc/list_shop_locations')) return send([{id:`location-${account}`,shop_id:shopId,name:`Private location ${account}`,status:'active',is_default:true}])
  if(url.pathname.endsWith('/rpc/shop_permission_access')) return send({})
  return send(null)
}).listen(4438,'127.0.0.1')
