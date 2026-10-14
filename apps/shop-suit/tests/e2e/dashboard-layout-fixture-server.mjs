// Synthetic provider contract only. No upstream transport or hosted writes.
import { createServer } from 'node:http'
const sessions = new Map(), latest = new Map()
let sequence = 0
let fixture = { shopDelayMs: 0, subscriptionDelayMs: 0, missingSubscription: false }
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
  const url = new URL(req.url, 'http://127.0.0.1:4440')
  const chunks=[]; for await(const chunk of req) chunks.push(chunk)
  const input = JSON.parse(Buffer.concat(chunks).toString() || '{}')
  if(url.pathname==='/fixture/config') {
    fixture = { shopDelayMs: Math.min(1000, Math.max(0, Number(input.shopDelayMs)||0)), subscriptionDelayMs: Math.min(1000, Math.max(0, Number(input.subscriptionDelayMs)||0)), missingSubscription: input.missingSubscription === true }
    return send({synthetic:true})
  }
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
  if (url.pathname.endsWith('/shops') && fixture.shopDelayMs) await new Promise(resolve => setTimeout(resolve, fixture.shopDelayMs))
  if (url.pathname.endsWith('/subscriptions')) {
    if (fixture.subscriptionDelayMs) await new Promise(resolve => setTimeout(resolve, fixture.subscriptionDelayMs))
    return send(fixture.missingSubscription ? [] : [{id:`subscription-${account}`,profile_id:`profile-${account}`,plan_id:'fixture-plan',status:'active',trial_end_at:null,current_period_end:'2026-11-13T00:00:00Z'}])
  }
  if (url.pathname.endsWith('/rpc/shop_billing_read')) {
    if (fixture.subscriptionDelayMs) await new Promise(resolve => setTimeout(resolve, fixture.subscriptionDelayMs))
    if (fixture.missingSubscription) return send({message:'SHOP_SUBSCRIPTION_NOT_FOUND'},400)
    return send({subscription:{planName:'Fixture plan',accessState:'active',periodEnd:'2026-11-13T00:00:00Z'}})
  }
  if (url.pathname.endsWith('/rpc/shop_permission_access')) return send({'reports.view':true,'reports.costs.view':true})
  if (url.pathname.endsWith('/rpc/shop_operating_report')) return send({locationId:null,period:'day',fromDate:'2026-10-13',toDateExclusive:'2026-10-14',canViewCosts:true,sales:0,saleCount:0,averageTicket:0,paymentsIn:0,salesMix:[],paymentMix:[],outstanding:{amount:0,customerCount:0,customers:[]},expenses:{amount:0,count:0,operatingBalance:0},appointments:{total:0,completed:0,cancelled:0,noShow:0,busiestTimes:[]},cash:{closedShifts:0,expected:0,counted:0,variance:0},staff:[],locations:[]})
  if (url.pathname.endsWith('/rpc/shop_operational_report')) return send({items:[],summary:{},total:0})
  if(url.pathname.endsWith('/portals')) return send({id:'shop-portal'})
  if(url.pathname.endsWith('/profiles')) return send({id:`profile-${account}`,status:'active',display_name:account,email_snapshot:user(account).email})
  if(url.pathname.endsWith('/shop_memberships')) return send([{id:`member-${account}`,shop_id:shopId,profile_id:`profile-${account}`,role:'owner',status:'active'}])
  if(url.pathname.endsWith('/shops')) return send([{id:shopId,name:`Private shop ${account}`,business_mode:'mixed',status:'active',created_at:'2026-10-01T00:00:00Z'}])
  if(url.pathname.endsWith('/rpc/list_shop_locations')) return send([{id:`location-${account}`,shop_id:shopId,name:`Private location ${account}`,status:'active',is_default:true}])
  if(url.pathname.endsWith('/rpc/shop_permission_access')) return send({})
  return send(null)
}).listen(4440,'127.0.0.1')
