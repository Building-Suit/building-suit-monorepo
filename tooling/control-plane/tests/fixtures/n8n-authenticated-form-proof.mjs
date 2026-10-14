// Run only inside the explicitly disposable n8n fixture. Never prints cookies or tokens.
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
(async()=>{
 const origin='http://localhost:5678',url=origin+'/form/cp-synthetic-authenticated-form';
 const login=await fetch(origin+'/rest/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailOrLdapLoginId:'synthetic@example.invalid',password:process.env.CP_N8N_FIXTURE_PASSWORD})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(cookie);
 const anonymous=await fetch(url,{redirect:'manual'});assert.ok([302,401,403].includes(anonymous.status),'Anonymous form must not expose authenticated operator workflow: '+anonymous.status);
 const fake=new FormData();fake.set('field-0','a0000000-0000-4000-8000-000000000001');fake.set('user','{"id":"a0000000-0000-4000-8000-000000000090"}');
 const denied=await fetch(url,{method:'POST',body:fake,redirect:'manual'});assert.ok([302,401,403].includes(denied.status),'Forged actor body admitted: '+denied.status);
 const jar=new Map(cookie.split(';').map(pair=>pair.split(/=(.*)/s).slice(0,2)));
 const headers=()=>({Cookie:[...jar].map(([k,v])=>k+'='+v).join('; ')});
 const request=async(target,options={})=>{const u=new URL(target,origin);u.port='5678';const r=await fetch(u,{...options,headers:{...headers(),...options.headers},redirect:'manual'});for(const value of r.headers.getSetCookie()){const pair=value.split(';')[0],split=pair.indexOf('=');jar.set(pair.slice(0,split),pair.slice(split+1))}return r};
 let page=await request(url);assert.equal(page.status,302);
 let authorization=await request(page.headers.get('location'));assert.equal(authorization.status,302);
 let data={redirectUrl:authorization.headers.get('location')};
 if(new URL(data.redirectUrl,origin).pathname==='/oauth/consent'){
  let consent=await request(origin+'/rest/consent/details');assert.equal(consent.status,200,await consent.clone().text());data=(await consent.json()).data;
  if(!data.autoApproved){consent=await request(origin+'/rest/consent/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved:true,scopes:data.scopes})});assert.equal(consent.status,200,await consent.clone().text());data=(await consent.json()).data}
 }
 assert.ok(data.redirectUrl);page=await request(data.redirectUrl);assert.equal(page.status,302);page=await request(page.headers.get('location'));assert.equal(page.status,200);const html=await page.text();assert.match(html,/Synthetic authenticated actor proof/);
 writeFileSync('/tmp/cp-authenticated-rendered-form.html',html);
 let token=html.match(/authToken\s*=\s*['"]([^'"]+)/)?.[1];
 if(!token){console.log(JSON.stringify({render_passed:true,token_field_missing:true}));process.exit(2)}

 const form=new FormData();form.set('field-0','a0000000-0000-4000-8000-000000000001');form.set('user','{"id":"a0000000-0000-4000-8000-000000000099"}');
 const submit=await fetch(url,{method:'POST',headers:{'x-auth-token':token},body:form});const body=await submit.text();assert.equal(submit.status,200,body);
 console.log(JSON.stringify({passed:true,authenticated_form_status:page.status,submission_status:submit.status,anonymous_status:anonymous.status,forged_actor_status:denied.status,expected_authenticated_actor:'a0000000-0000-4000-8000-000000000090'}));
})().catch(error=>{console.error(error.message);process.exit(1)});
