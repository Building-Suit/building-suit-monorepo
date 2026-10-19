// In-memory transport only; authorization assertions run against PostgreSQL.
export function seedAuditProtocol(data) {
  if(data.auditRows)return
  data.auditRows = [];data.personalAuditRows = data.users.map((user,index) => ({ id: `d1700000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,actor_user_id: user.id,entity_id: user.id,event_type: 'account.settings_updated',happened_at: '2026-10-17T01:00:00Z' }))
  for(const member of data.memberships)for(const grant of member.grants)if(grant.location_id!==data.locations[1].id)grant.capabilities = [...new Set([...grant.capabilities,'audit.read'])]
  let id = 0
  for(const [practiceIndex,count]of [[0,25],[1,1]])for(let n=0;n<count;n++)data.auditRows.push({ id: String(++id),practice_id: data.practices[practiceIndex].id,location_id: data.locations[practiceIndex===0 ? 0 : 2].id,actor_user_id: data.practices[practiceIndex].owner_user_id,event_type: 'patient.created',entity_id: data.patientRows.find(row => row.practice_id===data.practices[practiceIndex].id).id,happened_at: new Date(Date.UTC(2026,9,17,0,n)).toISOString() })
  for(const event_type of ['secretary.invited','document.download_requested'])data.auditRows.push({ id: String(++id),practice_id: data.practices[0].id,location_id: event_type.startsWith('secretary.') ? null : data.locations[0].id,actor_user_id: data.practices[0].owner_user_id,event_type,entity_id: data.users[2].id,happened_at: '2026-10-17T01:00:00Z' })
}
export function auditProtocol({ data,actor,rpc,input,send,capability,owner }) {
  if(!['doctor_administrative_audit','doctor_personal_account_audit'].includes(rpc))return false
  const personal = rpc==='doctor_personal_account_audit';const location = data.locations.find(row => row.id===input.p_location && row.practice_id===input.p_practice && !row.archived_at)
  if(!personal && !owner(input.p_practice) && (!location || !capability(input.p_practice,input.p_location,'audit.read'))) { send({ code: '42501',message: 'DOCTOR_ACCESS_DENIED' },403);return true }
  const search = String(input.p_query || '').trim().toLowerCase();const page = input.p_page || 0
  const rows = (personal ? data.personalAuditRows.filter(row => row.actor_user_id===actor.id) : data.auditRows.filter(row => row.practice_id===input.p_practice && (owner(input.p_practice) || (row.location_id===input.p_location && capability(row.practice_id,row.location_id,'audit.read') && (row.event_type.startsWith('patient.') ? capability(row.practice_id,row.location_id,'patients.read') : row.event_type.startsWith('document.') ? capability(row.practice_id,row.location_id,'documents.read') && capability(row.practice_id,row.location_id,'patients.read') : false)))))
    .filter(row => `${row.event_type} ${row.actor_user_id} ${row.entity_id} ${row.id}`.toLowerCase().includes(search)).sort((a,b) => b.happened_at.localeCompare(a.happened_at) || b.id.localeCompare(a.id))
  send({ items: rows.slice(page*20,page*20+20).map(({ id,actor_user_id,event_type,entity_id,happened_at }) => ({ id,actor_user_id,event_type,entity_id,happened_at })),total: rows.length,page });return true
}
