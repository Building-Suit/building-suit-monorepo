import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

export const localApi = 'http://127.0.0.1:61321'
// Existing public disposable-backend key from packages/testing/playwright.config.ts; never a hosted/service key.
export const localAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
export function sql(statement) {
  const result = spawnSync('docker', ['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'], { input: statement, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Disposable SQL failed')
  return result.stdout.trim().split('\n').filter(Boolean).at(-1)
}
export function actorSql(userId, statement) { return sql(`select set_config('request.jwt.claim.sub','${userId}',false); set role authenticated; ${statement}`) }
export function makeFixture({ currency = 'EGP' } = {}) {
  const userId = randomUUID(); const email = `${userId}@offline-counter.invalid`
  const password = 'Local-offline-fixture-2026!'
  // Synthetic confirmed fixture only, consistent with existing disposable SQL suites. No mail is sent.
  sql(`insert into auth.users(id,instance_id,email,encrypted_password,aud,role,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${userId}','00000000-0000-0000-0000-000000000000','${email}',extensions.crypt('${password}',extensions.gen_salt('bf')),'authenticated','authenticated',now(),'','','','','{"provider":"email","providers":["email"]}','{"display_name":"Offline fixture operator"}',now(),now());
    insert into auth.identities(id,user_id,provider,provider_id,identity_data,created_at,updated_at)
    values(gen_random_uuid(),'${userId}','email','${userId}',jsonb_build_object('sub','${userId}','email','${email}','email_verified',true),now(),now());`)
  const shopId = actorSql(userId, "select public.create_owner_shop('Offline cloud counter','product'::public.business_mode);")
  if (!['EGP','USD','EUR','GBP','SAR','AED'].includes(currency)) throw new Error('Unsupported disposable fixture currency')
  actorSql(userId, `select public.save_business_currency('${shopId}','${currency}');`)
  const locationId = sql(`select id from public.shop_locations where shop_id='${shopId}' and is_default;`)
  const staffId = sql(`select id from public.shop_memberships where shop_id='${shopId}' and role='owner';`)
  const productId = actorSql(userId, `select public.save_product('${shopId}',null,'Offline cloud product','OFF-CLOUD',null,20);`)
  actorSql(userId, `select public.adjust_stock('${randomUUID()}','${shopId}','${productId}',10,10,'Offline cloud fixture stock');`)
  const shiftId = actorSql(userId, `select public.open_cash_shift('${randomUUID()}','${shopId}','${locationId}','main',100,null);`)
  return { userId, email, password, shopId, locationId, staffId, productId, shiftId }
}
export async function login(fixture) {
  const response = await fetch(`${localApi}/auth/v1/token?grant_type=password`, { method:'POST',headers:{ apikey: localAnonKey,'content-type':'application/json' },body:JSON.stringify({ email:fixture.email,password:fixture.password }) })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error(`Local fixture authentication failed (${response.status})`)
  return data.access_token
}
export function saleArgs(fixture) {
  return { p_request_id: randomUUID(),p_save_request_id:randomUUID(),p_issue_request_id:randomUUID(),p_payment_request_id:randomUUID(),p_appointment_request_id:null,p_shop_id:fixture.shopId,p_location_id:fixture.locationId,p_shift_id:fixture.shiftId,p_staff_membership_id:fixture.staffId,p_appointment_id:null,p_customer_id:null,p_notes:null,p_lines:[{item_type:'product',source_id:fixture.productId,quantity:1}],p_amount:20,p_paid_at:new Date().toISOString(),p_method:'cash',p_reference:null }
}
export async function rpc(token,name,args) {
  const response = await fetch(`${localApi}/rest/v1/rpc/${name}`,{ method:'POST',headers:{ apikey:localAnonKey,authorization:`Bearer ${token}`,'content-type':'application/json' },body:JSON.stringify(args) })
  const data = await response.json(); return { ok:response.ok,status:response.status,data }
}
