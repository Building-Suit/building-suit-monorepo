// Called only by the maintained run-owned loopback Supabase acceptance runner.
import {isDeepStrictEqual} from 'node:util'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {emptyClinicalSnapshot,clinicalReleased,verifyClinicalExport} from '../app/utils/clinical.ts'
import {verifyDoctorClinicalBrowser} from './clinical-actual-browser.mjs'
export async function verifyDoctorClinicalProvider({root,api,origin,publicKey,serviceKey,bootstrap,confirmedActor,rpc,sql,endpoint,pdf,expect,setStage}) {
 const uuid=value=>{expect(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),'Clinical fixture UUID rejected');return value}
 setStage('actual clinical independent confirmed identities')
 const owner=await bootstrap(publicKey,'clinical-owner'),other=await bootstrap(publicKey,'clinical-other'),recipient=await confirmedActor(publicKey,'clinical-recipient'),staff=await confirmedActor(publicKey,'clinical-staff')
 async function invite(principal){const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(Buffer.from(token,'hex')).digest('hex');const value=await rpc(principal.client,'doctor_invite_secretary',{p_practice:principal.scope.practiceId,p_email:staff.user.email,p_grants:[{location_id:principal.scope.locationId,capabilities:['patients.read','patients.write']}],p_token_hash:hash,p_key:randomUUID()});await rpc(staff.client,'doctor_accept_secretary_invitation',{p_invitation:value.invitation_id,p_token:token,p_key:randomUUID()})}
 await invite(owner);await invite(other)
 const scope=actor=>({p_practice:actor.scope.practiceId,p_location:actor.scope.locationId})
 expect((await rpc(owner.client,'doctor_clinical_workspace',scope(owner))).available===false,'Administrative owner acquired clinical access')
 expect((await rpc(other.client,'doctor_clinical_workspace',scope(other))).available===false,'Independent administrative owner acquired clinical access')
 const grant=(principal,user,caps)=>`insert into doctor_private.clinical_fixture_grants(practice_id,location_id,user_id,capabilities,purpose,evidence_ref,policy_version,valid_until) values('${uuid(principal.scope.practiceId)}','${uuid(principal.scope.locationId)}','${uuid(user.user.id)}',array[${caps.map(cap=>`'${cap}'`).join(',')}],'synthetic_fixture','owned-actual-provider-m2','synthetic-engineering-v1',clock_timestamp()+interval '1 hour');`
 sql(grant(owner,owner,['read','draft','review','sign','release','export'])+grant(other,other,['read','draft','review','sign','release','export'])+grant(owner,staff,['read','draft'])+`insert into doctor_private.clinical_recipient_grants(practice_id,patient_id,user_id,purpose,valid_until) values('${uuid(owner.scope.practiceId)}','${uuid(owner.scope.patientId)}','${uuid(recipient.user.id)}','synthetic_fixture',clock_timestamp()+interval '1 hour');`)
 expect((await rpc(staff.client,'doctor_clinical_workspace',scope(owner))).available===true&&(await rpc(staff.client,'doctor_clinical_workspace',scope(other))).available===false,'Actual A fixture grant crossed an independent B administrative membership')
 setStage('actual clinical draft identity retry and cross-practice denial')
 let encounter;const source=emptyClinicalSnapshot();source.note.sections[0].text='Synthetic entered note / نص اصطناعي <literal>'
 function args(action,input,key=randomUUID()){return{...scope(owner),p_encounter:action==='create'?null:encounter.encounter_id,p_expected_version:action==='create'?null:encounter.version,p_action:action,p_input:input,p_key:key}}
 async function command(action,input){encounter=await rpc(owner.client,'doctor_clinical_command',args(action,input));return encounter}
 const first=args('create',{patient_id:owner.scope.patientId,snapshot:source});encounter=await rpc(owner.client,'doctor_clinical_command',first);expect((await rpc(owner.client,'doctor_clinical_command',first)).encounter_id===encounter.encounter_id,'Actual clinical creation replay duplicated encounter')
 const encounterId=encounter.encounter_id
 const detail=()=>rpc(owner.client,'doctor_clinical_detail',{...scope(owner),p_encounter:encounterId})
 const denied=async(client,name,parameters,label)=>expect((await client.rpc(name,parameters)).error?.code==='42501',label)
 await denied(other.client,'doctor_clinical_detail',{...scope(owner),p_encounter:encounterId},'Foreign practice actual chart admitted')
 expect((await owner.client.from('clinical_versions').select('*')).error?.code==='42501','Direct actual chart table readable')
 setStage('actual clinical intake source fidelity and delegated authority')
 source.intake=[{id:randomUUID(),kind:'allergy',knowledge:'unknown',text:'',value:'',unit:'',source:'patient'},{id:randomUUID(),kind:'history',knowledge:'reported',text:'Synthetic literal history / تاريخ اصطناعي',value:'',unit:'',source:'staff'}]
 await command('save',{snapshot:source});const forged=structuredClone(source);forged.intake[0].source='clinician'
 await denied(staff.client,'doctor_clinical_command',args('save',{snapshot:forged}),'Actual staff fabricated reviewer provenance')
 await denied(staff.client,'doctor_clinical_command',args('finalize',{reviewed_version_id:encounter.version_id,reviewed_sha256:'0'.repeat(64)}),'Actual staff finalized an encounter')
 setStage('actual clinical explicit prescription and private result lifecycle')
 source.prescriptions=[{id:randomUUID(),medicine:{identity:'synthetic-only-A',label:'Entered synthetic compound',provenance:'synthetic_manual',source_version:'manual-synthetic-v1',strength:'entered strength',form:'entered form'},dose:{amount:'1.2500',unit:'entered unit',route:'entered route'},start_date:'2026-10-20',end_date:'2026-10-22',instructions:'Synthetic instruction <not markup> / تعليمات اصطناعية',segments:[{kind:'as_needed',start_date:'2026-10-20',end_date:'2026-10-22',timezone:'Africa/Cairo',interval_minutes:null,weekdays:[],times:[],instructions:'Explicit synthetic schedule only'}]}]
 const order={id:randomUUID(),kind:'lab',request:'Synthetic authored request only',due_at:'2026-10-22T10:00:00+02:00',state:'requested',reason:''};source.orders=[order]
 const upload=await endpoint(owner,'upload',{filename:'synthetic-clinical-result.pdf'},pdf);expect(upload.status===200,'Actual clinical private upload failed');const document=await upload.json();uuid(document.versionId)
 const result={id:randomUUID(),order_id:order.id,document_version_id:document.versionId,stage:'uploaded',annotation:'Synthetic entered annotation'};source.results=[result];await command('save',{snapshot:source})
 for(const stage of ['received','reviewed','released']){result.stage=stage;await command('save',{snapshot:source})}
 expect(isDeepStrictEqual((await detail()).versions[0].snapshot,source),'Actual clinical snapshot changed entered content')
 setStage('actual clinical exact reviewed finalization and stale writer denial')
 await command('start',{});const reviewed=(await detail()).versions[0]
 const finalArgs=args('finalize',{reviewed_version_id:reviewed.id,reviewed_sha256:reviewed.snapshot_sha256});encounter=await rpc(owner.client,'doctor_clinical_command',finalArgs)
 expect((await rpc(owner.client,'doctor_clinical_command',finalArgs)).version_id===encounter.version_id,'Actual finalization replay changed revision')
 expect((await owner.client.rpc('doctor_clinical_command',{...args('save',{snapshot:source}),p_expected_version:1})).error?.code==='40001','Actual stale write replaced current chart')
 expect((await owner.client.rpc('doctor_clinical_command',args('save',{snapshot:source}))).error?.code==='22023','Actual finalized chart was editable')
 const final=(await detail()).versions[0];expect(final.professional_signature===false&&final.synthetic_attestation===true,'Fixture finalization claimed professional authority')
 setStage('actual clinical bound recipient projection and private byte delivery')
 await command('release',{recipient_user_id:recipient.user.id,expires_at:new Date(Date.now()+3600000).toISOString()});const releaseId=encounter.release_id
 const released=clinicalReleased(await rpc(recipient.client,'doctor_clinical_released',{p_release:releaseId}),releaseId)
 expect(released.prescriptions[0].dose.amount==='1.2500'&&!Object.hasOwn(released,'note')&&!Object.hasOwn(released,'intake'),'Actual released projection lost precision or disclosed private work')
 await denied(other.client,'doctor_clinical_released',{p_release:releaseId},'Actual unrelated recipient read admitted')
 await denied(recipient.client,'doctor_clinical_detail',{...scope(owner),p_encounter:encounterId},'Actual release conferred chart membership')
 const deliver=(actor,key=randomUUID())=>fetch(`${api}/functions/v1/doctor-clinical-release`,{method:'POST',headers:{apikey:publicKey,authorization:`Bearer ${actor.session.access_token}`,origin,'x-doctor-release':encodeURIComponent(JSON.stringify({releaseId,versionId:document.versionId,key}))},signal:AbortSignal.timeout(15000)})
 const bytes=await deliver(recipient);expect(bytes.status===200&&Buffer.from(await bytes.arrayBuffer()).equals(Buffer.from(pdf))&&bytes.headers.get('cache-control')?.includes('no-store'),'Actual released private bytes differ or are cacheable')
 expect([401,403].includes((await deliver(other)).status),'Actual foreign recipient byte delivery admitted')
 const sharedDownloadKey=randomUUID(),duplicates=await Promise.all([deliver(recipient,sharedDownloadKey),deliver(recipient,sharedDownloadKey)]);for(const response of duplicates)expect(response.status===200&&Buffer.from(await response.arrayBuffer()).equals(Buffer.from(pdf)),'Actual concurrent delivery retry differed');expect(sql(`select count(*) from doctor_private.command_receipts where actor_user_id='${uuid(recipient.user.id)}' and command_key='${uuid(sharedDownloadKey)}';`)==='1','Actual duplicate delivery audit intent was not idempotent')

 setStage('actual clinical verified complete export')
 const exportArgs={...scope(owner),p_encounter:encounterId,p_key:randomUUID()};const exported=await rpc(owner.client,'doctor_clinical_export',exportArgs);const manifest=JSON.parse(await verifyClinicalExport(exported));expect(manifest.versions.length===(await detail()).versions_total&&manifest.storage_bytes_included===false,'Actual export omitted revisions or claimed Storage bytes')
 await verifyDoctorClinicalBrowser({root,api,origin,publicKey,serviceKey,owner,other,recipient,staff,encounterId,releaseId,document,pdf,expect,setStage})
 setStage('actual clinical supersession revocation and fresh export authority')
 await command('amend',{reason:'Synthetic correction preserves prior source'});expect((await detail()).versions.some(v=>v.id===final.id&&v.version_status==='superseded'),'Actual amendment rewrote or lost finalized original')
 await denied(recipient.client,'doctor_clinical_released',{p_release:releaseId},'Actual superseded source remained released');expect([401,403].includes((await deliver(recipient)).status),'Actual superseded source bytes remained available')
 sql(`update doctor_private.clinical_fixture_grants set revoked_at=clock_timestamp() where practice_id='${uuid(owner.scope.practiceId)}' and user_id='${uuid(owner.user.id)}';`)
 await denied(owner.client,'doctor_clinical_export',exportArgs,'Actual revoked fixture reused export receipt')
 expect((await rpc(other.client,'doctor_clinical_workspace',scope(other))).available===true,'Independent actual Doctor context was changed by A revocation')
 console.log('Actual synthetic M2: confirmed independent Auth, delegated scope, exact entered content, version/hash finalization, preserved amendments, bound recipient/private bytes and current complete export passed; professional clinical approval remains OPEN.')
}
