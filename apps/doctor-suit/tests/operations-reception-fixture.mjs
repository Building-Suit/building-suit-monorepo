// Disposable test fixture only. Actual Auth, atomic APIs and run-owned SQL data.
import{spawnSync}from'node:child_process'
import{randomUUID}from'node:crypto'
export async function prepareReceptionFixture({admin,actor,rpc}){
 const zone=new Date().getUTCHours()>=12?'Etc/GMT+12':'Etc/UTC',owner=await actor('reception owner',zone),scope={p_practice:owner.scope.practiceId,p_location:owner.scope.locationId}
 await rpc(owner.client,'doctor_write_schedule',{...scope,p_expected_version:0,p_location_version:1,p_input:{slot_minutes:10,weekly:Array.from({length:7},(_,weekday)=>({weekday,start:0,end:1440})),exceptions:[]},p_key:randomUUID()})
 const patient=async name=>(await rpc(owner.client,'doctor_write_patient',{...scope,p_input:{name,phone:'',email:'',date_of_birth:null},p_key:randomUUID()})).patient_id
 const queuePatient=await patient('Synthetic reception waiting patient'),missedPatient=await patient('Synthetic reception missed patient'),walkPatient=await patient('Synthetic reception walk-in patient')
 const credentials={email:`synthetic-reception-staff-${randomUUID()}@example.test`,password:`A!${randomUUID()}a9`},staff=await admin.auth.admin.createUser({...credentials,email_confirm:true});if(staff.error||!staff.data.user)throw new Error('Reception Auth fixture creation failed')
 const late=randomUUID(),queue=randomUUID(),missed=randomUUID(),membership=randomUUID(),user=staff.data.user.id
 for(const value of[owner.userId,owner.scope.practiceId,owner.scope.locationId,owner.scope.patientId,queuePatient,missedPatient,walkPatient,user,late,queue,missed,membership])if(!/^[0-9a-f-]{36}$/.test(value))throw new Error('Synthetic UUID rejected')
 const midnight=`(((clock_timestamp()at time zone'${zone}')::date)::timestamp at time zone'${zone}')`
 const query=`insert into public.memberships(id,practice_id,user_id,capabilities)values('${membership}','${owner.scope.practiceId}','${user}',array['appointments.read','appointments.write','patients.read','queue.manage']);insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values('${owner.scope.practiceId}','${membership}','${owner.scope.locationId}',array['appointments.read','appointments.write','patients.read','queue.manage']);
 insert into public.appointments(id,practice_id,location_id,doctor_user_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at)
 select id::uuid,'${owner.scope.practiceId}','${owner.scope.locationId}','${owner.userId}',patient::uuid,starts,starts+interval'10 minutes','${zone}','Synthetic reception owner clinic',state,'${owner.userId}',arrival from(values('${late}','${owner.scope.patientId}',${midnight},'booked',null::timestamptz),('${queue}','${queuePatient}',${midnight}+interval'20 minutes','checked_in',clock_timestamp()-interval'1 minute'),('${missed}','${missedPatient}',${midnight}-interval'1 day','no_show',null::timestamptz))v(id,patient,starts,state,arrival);`
 const result=spawnSync('docker',['exec','-i','supabase_db_building-suit-doctor','psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',timeout:15000});if(result.status!==0)throw new Error('Owned reception SQL fixture failed')
 return{owner:{credentials:owner.credentials,scope:owner.scope},staff:{credentials,scope:owner.scope},records:{late,queue,missed,walkPatient,staffUser:user},zone,day:new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
}
