import{test,expect,operationsFixture,operationsClient,openOperations}from'./operations-actual-fixture'
import{randomUUID}from'node:crypto'
test('DOS-M3-006: persisted withdrawal suppression and redacted operational status',async({browser})=>{
 const f=operationsFixture(),owner=await operationsClient('owner'),other=await operationsClient('other'),s={p_practice:f.owner.scope.practiceId,p_location:f.owner.scope.locationId,p_patient:f.owner.scope.patientId}
 const rpc=async(name:string,args:object)=>{const{data,error}=await owner.rpc(name,args);expect(error).toBeNull();return data}
 const contact=randomUUID(),consent=randomUUID(),message=randomUUID(),date=new Date(Date.now()-300000),day=date.toISOString().slice(0,10),minute=date.getUTCHours()*60+date.getUTCMinutes()
 await rpc('doctor_contact_command',{...s,p_record:contact,p_expected_version:0,p_action:'create_contact',p_input:{channel:'sms',destination:'+15550006666',recipient_kind:'patient',guardian_id:null},p_key:randomUUID()})
 await rpc('doctor_contact_command',{...s,p_record:consent,p_expected_version:0,p_action:'grant_consent',p_input:{contact_id:contact,contact_version:1,purpose:'appointment_reminder',source_ref:'Synthetic outbox explicit receipt',source_day:day,source_minute:minute,location_version:1},p_key:randomUUID()})
 const command=(action:string,version:number,input:object={})=>rpc('doctor_outbox_command',{...s,p_message:message,p_version:version,p_action:action,p_input:input,p_key:randomUUID()})
 expect((await command('enqueue',0,{intent:{contact_id:contact,contact_version:1,purpose:'appointment_reminder',consent_version:1,guardian_version:null},template:'appointment_reminder_v1',parameters:{},expires_at:new Date(Date.now()+86400000).toISOString()})).state).toBe('queued')
 await rpc('doctor_contact_command',{...s,p_record:consent,p_expected_version:1,p_action:'revoke_consent',p_input:{source_ref:'Synthetic persisted-queue withdrawal'},p_key:randomUUID()})
 const suppressed=await command('claim',1);expect(suppressed.state).toBe('failed');expect(suppressed.blocker).toBe('consent_unavailable');expect(suppressed.external_delivery).toBe(false)
 expect((await other.rpc('doctor_outbox',{...s,p_page:0})).error?.code).toBe('42501')
 const v=await openOperations(browser,'/messages')
 try{const select=v.page.getByRole('combobox',{name:'Selected patient',exact:true});await expect(select).toBeEnabled();await select.click();await v.page.getByRole('option',{name:'Synthetic operations owner patient',exact:true}).click();await expect(v.page.getByRole('cell',{name:'Consent unavailable',exact:true})).toBeVisible();await expect(v.page.getByText(/External delivery is disabled/)).toBeVisible();await expect(v.page.getByText('+15550006666',{exact:true})).toHaveCount(0);await v.page.screenshot({path:'test-results/doctor-m3-actual/outbox-suppressed.png'});await v.page.setViewportSize({width:390,height:844});await expect.poll(()=>v.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}finally{await v.context.close()}
})
