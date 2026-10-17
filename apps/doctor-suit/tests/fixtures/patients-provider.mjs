// Owned synthetic browser transport only. Real authorization/locking is tested in PostgreSQL.
import { createHash,randomUUID } from 'node:crypto'
import { validDoctorPatientForm,doctorPatientToday } from '../../app/utils/patients.ts'
export function seedPatientProtocol(data) {
  if (data.patientRows) return
  const id = (prefix,n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  data.patientRows = []; data.patientActivity = []; data.patientCommands = {}
  data.practices.forEach((practice,index) => {
    const locations = data.locations.filter(item => item.practice_id===practice.id)
    const actor = practice.owner_user_id
    const grants = locations.map((item,position) => ({ location_id: item.id,capabilities: index===0 && position===0 ? ['patients.read','patients.write','locations.read'] : ['patients.read'] }))
    data.memberships.push({ id: id('b5',index+1),practice_id: practice.id,user_id: data.users[2].id,status: 'active',version: 1,created_at: '2026-01-01T00:00:00Z',grants })
    for (let n=1;n<=(index===0 ? 24 : 3);n++) {
      const sequence = index*100+n
      data.patientRows.push({ id: id('b4',sequence),practice_id: practice.id,patient_identity_id: id('b1',sequence),name: index===0 && n===1 ? 'Synthetic household' : `Synthetic ${index===0 ? 'A' : 'B'} patient ${String(n).padStart(2,'0')}`,phone: n===1 ? '+1 202 555 0100' : '',email: '',date_of_birth: null,created_location_id: locations[0].id,created_by: actor,created_at: '2026-01-01T00:00:00Z',updated_at: '2026-01-01T00:00:00Z',archived_at: null,version: 1,provenance: 'entered_unverified' })
    }
  })
}
export function patientProtocol({ data,actor,sessionId,rpc,input,send,capability }) {
  if (!['doctor_patients','doctor_patient','doctor_patient_duplicate_review','doctor_write_patient','doctor_archive_patient'].includes(rpc)) return false
  const reject = (code='42501',message='DOCTOR_ACCESS_DENIED') => { send({ code,message },400); return true }
  const location = data.locations.find(item => item.id===input.p_location && item.practice_id===input.p_practice && !item.archived_at)
  if (!location || !capability(input.p_practice,location.id,'patients.read')) return reject()
  const canWrite = capability(input.p_practice,location.id,'patients.write')
  const scoped = data.patientRows.filter(item => item.practice_id===input.p_practice)
  if (rpc==='doctor_patients') {
    const size = input.p_size ?? 25; const page = input.p_page ?? 0; const search = input.p_search || ''; const status = input.p_status || 'active'
    if (!Number.isInteger(size) || size<1 || size>100 || !Number.isInteger(page) || page<0 || search.length>160 || !['active','archived','all'].includes(status)) return reject('22023','DOCTOR_PATIENT_QUERY_INVALID')
    const digits = value => value.replace(/\D/g,''); const needle = search.toLowerCase()
    const rows = scoped.filter(item => (status==='all' || Boolean(item.archived_at)===(status==='archived')) && (item.name.toLowerCase().includes(needle) || item.email.toLowerCase().includes(needle) || (digits(search) && digits(item.phone).includes(digits(search))))).sort((a,b) => a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
    send({ rows: rows.slice(page*size,(page+1)*size),total: rows.length,can_write: canWrite }); return true
  }
  const row = input.p_patient && scoped.find(item => item.id===input.p_patient)
  if (input.p_patient && !row) return reject()
  if (rpc==='doctor_patient') { send({ patient: row,activity: data.patientActivity.filter(item => item.patient_id===row.id),activity_total: data.patientActivity.filter(item => item.patient_id===row.id).length,can_write: canWrite }); return true }
  if (!canWrite) return reject()
  const raw = input.p_input
  const form = raw && { name: raw.name?.trim(),phone: raw.phone?.trim(),email: raw.email?.trim(),dateOfBirth: raw.date_of_birth || '' }
  if (rpc!=='doctor_archive_patient' && (!form || !validDoctorPatientForm(form,doctorPatientToday(location.timezone)))) return reject('22023','DOCTOR_PATIENT_INVALID')
  function review() {
    const digits = value => value.replace(/\D/g,'')
    const rows = scoped.filter(item => item.id!==input.p_patient && (item.name.toLowerCase()===form.name.toLowerCase() || (digits(form.phone) && digits(item.phone)===digits(form.phone)) || (form.email && item.email.toLowerCase()===form.email.toLowerCase()))).sort((a,b) => a.id.localeCompare(b.id))
    const material = JSON.stringify([actor.id,sessionId,input.p_practice,input.p_location,input.p_patient,form,rows.map(item => [item.id,item.version])])
    return { rows: rows.slice(0,10),total: rows.length,review_key: rows.length ? createHash('sha256').update(material).digest('hex') : null }
  }
  if (rpc==='doctor_patient_duplicate_review') { send(review()); return true }
  const receipt = `${actor.id}:${input.p_key}`; const fingerprint = JSON.stringify([rpc,input])
  const prior = data.patientCommands[receipt]
  if (prior) { if (prior.fingerprint!==fingerprint) return reject('22023','DOCTOR_IDEMPOTENCY_CONFLICT'); send(prior.result); return true }
  if (row && row.version!==input.p_expected_version) return reject('40001','DOCTOR_PATIENT_CONFLICT')
  if (row?.archived_at) return reject('22023','DOCTOR_PATIENT_ARCHIVED')
  let item = row; const now = new Date().toISOString()
  if (rpc==='doctor_write_patient') {
    const duplicates = review()
    if (duplicates.total && duplicates.review_key!==input.p_duplicate_review) return reject('40001','DOCTOR_PATIENT_DUPLICATE_REVIEW')
    if (!item) {
      item = { id: randomUUID(),practice_id: input.p_practice,patient_identity_id: randomUUID(),created_location_id: input.p_location,created_by: actor.id,created_at: now,archived_at: null,version: 0,provenance: 'entered_unverified' }
      data.patientRows.push(item)
    }
    Object.assign(item,{ name: form.name,phone: form.phone,email: form.email,date_of_birth: form.dateOfBirth || null })
  } else item.archived_at = now
  item.version++; item.updated_at = now
  data.patientActivity.push({ practice_id: input.p_practice,patient_id: item.id,location_id: input.p_location,actor_user_id: actor.id,event_type: rpc==='doctor_archive_patient' ? 'patient.archived' : row ? 'patient.corrected' : 'patient.created',record_version: item.version,happened_at: now })
  const result = { patient_id: item.id,version: item.version }; data.patientCommands[receipt] = { fingerprint,result }; send(result); return true
}
