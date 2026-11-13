import {doctorAppointmentBoard,doctorAppointmentHistory,doctorAppointmentResult,doctorAvailability,doctorPatientDirectory,consultationDirectory,consultationType,validDoctorAppointmentCommand} from '@building-suit/contracts'
import {nativePatientScopeKey} from './nativePatients.ts'
import {createNativeScopedRpc} from './nativeScopedRpc.ts'
import type {NativeContextChoice} from './nativeContext.ts'
import type {NativeAppointmentsPort,NativeScheduleScope} from './nativeAppointments.ts'
export function createNativeAppointmentsRepository(dependencies:Parameters<typeof createNativeScopedRpc>,choices:()=>NativeContextChoice[],scope:()=>NativeScheduleScope|null):NativeAppointmentsPort {
 const [configuration,transport,session,current,contexts,reject]=dependencies
 const denied=()=>Object.assign(new Error('Current appointment access required'),{code:'42501'})
 const selected=(practice:string,location:string)=>{const value=scope();if(!value||value.practiceId!==practice||value.locationId!==location)throw denied();return value}
 async function rpc(name:string,args:Record<string,unknown>,value:NativeScheduleScope,signal:AbortSignal,caps:string[],destination=value.locationId){
  if(!caps.every(cap=>value.capabilities.includes(cap)))throw denied()
  const choice=destination===value.locationId?current():choices().find(x=>x.context.locationId===destination&&x.context.practiceId===value.practiceId&&x.context.doctorId===value.doctorId&&x.context.userId===value.userId&&x.context.sessionId===value.sessionId)
  if(!choice||!caps.every(cap=>choice.context.capabilities.includes(cap)))throw denied()
  const origin=nativePatientScopeKey(value)
  const call=createNativeScopedRpc(configuration,transport,session,()=>nativePatientScopeKey(current()?.context??null)===origin?choice:null,contexts,reject)
  return call(name,args,choice.context,signal,caps[0]??null)
 }
 return {
  async consultations(practice,location,signal){const value=selected(practice,location);return consultationDirectory(await rpc('doctor_consultation_types',{},value,signal,['appointments.read']),practice,location).types},
  async board(practice,location,query,signal){const value=selected(practice,location);return doctorAppointmentBoard(await rpc('doctor_appointment_board',{p_day:query.date,p_page:query.page,p_queue_page:query.queuePage},value,signal,['appointments.read']),practice,location,query)},
  async history(practice,location,id,page,signal){const value=selected(practice,location);return doctorAppointmentHistory(await rpc('doctor_appointment_history',{p_appointment:id,p_page:page},value,signal,['appointments.read']),practice,location,id,page)},
  async patients(practice,location,search,signal){const value=selected(practice,location);return doctorPatientDirectory(await rpc('doctor_patients',{p_page:0,p_size:20,p_search:search,p_status:'active'},value,signal,['patients.read']),practice)},
  async offers(practice,location,date,signal,selection){const value=scope();if(!value||value.practiceId!==practice)throw denied();const data=selection?await rpc('doctor_consultation_availability',{p_day:date,p_type:selection.typeId??null,p_version:selection.typeVersion??null,p_appointment:selection.appointmentId??null},value,signal,['appointments.read','appointments.write','patients.read'],location):await rpc('doctor_availability',{p_day:date},value,signal,['appointments.read','appointments.write','patients.read'],location);if(selection&&!selection.appointmentId){const row=data as Record<string,unknown>,type=consultationType(row.consultation,practice);if(type.id!==selection.typeId||type.version!==selection.typeVersion)throw new Error('Invalid consultation availability')};return doctorAvailability(data,practice,location,date)},
  async command(practice,location,input,key,signal){
   const value=selected(practice,location);if(!validDoctorAppointmentCommand(input)||((input.kind==='book'||input.kind==='walk_in')&&input.destinationId!==location))throw Object.assign(new Error('Invalid appointment command'),{code:'22023'})
   const reception=input.kind==='reception'||input.kind==='walk_in',queue=input.kind==='transition'&&!['cancelled','no_show'].includes(input.state)
   const caps=reception?['appointments.read','appointments.write','queue.manage','patients.read']:['appointments.read',queue?'queue.manage':'appointments.write']
   if(input.kind==='reschedule'&&input.destinationId!==location){const destination=choices().find(x=>x.context.locationId===input.destinationId&&x.context.practiceId===practice&&x.context.doctorId===value.doctorId&&x.context.userId===value.userId&&x.context.sessionId===value.sessionId),actor=session.identity();if(!destination||!actor||!['appointments.read','appointments.write','patients.read'].every(cap=>destination.context.capabilities.includes(cap)))throw denied();const fresh=await contexts.resolve(destination,actor,signal);if(signal.aborted||nativePatientScopeKey(fresh.context)!==nativePatientScopeKey(destination.context))throw denied()}
   let name:string,args:Record<string,unknown>
   if(reception){name='doctor_reception_command';args={p_appointment:input.kind==='reception'?input.appointmentId:null,p_expected_version:input.kind==='reception'?input.version:0,p_action:input.kind==='reception'?input.action:'walk_in',p_input:input.kind==='reception'?{reason:input.reason}:{patient_id:input.patientId,day:input.date,minute:input.minute,schedule_version:input.scheduleVersion,location_version:input.locationVersion,type_id:input.typeId??null,type_version:input.typeVersion??null,reason:input.reason},p_key:key}}
   else if(input.kind==='transition'){name='doctor_transition_appointment';args={p_appointment:input.appointmentId,p_expected_version:input.version,p_state:input.state,p_reason:input.reason,p_key:key}}
   else if(input.kind==='reschedule'){name='doctor_reschedule_appointment';args={p_appointment:input.appointmentId,p_expected_version:input.version,p_destination:input.destinationId,p_day:input.date,p_minute:input.minute,p_schedule_version:input.scheduleVersion,p_location_version:input.locationVersion,p_reason:input.reason,p_key:key}}
   else {name=input.typeId?'doctor_book_consultation':'doctor_book_appointment';args={p_patient:input.patientId,p_day:input.date,p_minute:input.minute,p_schedule_version:input.scheduleVersion,p_location_version:input.locationVersion,p_key:key,...(input.typeId?{p_type:input.typeId,p_type_version:input.typeVersion}:{})}}
   return doctorAppointmentResult(await rpc(name,args,value,signal,caps))
  },
 }
}
