// Opt-in combined browser transport. Real commands/authority are tested in
// dos-m1-020.sql and milestone-actual-provider.mjs, never inferred here.
import { randomUUID } from 'node:crypto'
import { doctorAvailabilityToday } from '../../app/utils/availability.ts'
export function initializeMilestoneProtocol(data) {
  if(data.milestoneInitialized)return
  data.milestoneInitialized = true;data.milestoneDrafts = {};data.milestoneCompletions = {};data.milestoneLocationCommands = {};data.milestoneCompleteCalls = 0
  const owner = data.users[0].id;const practice = data.practices.find(item => item.owner_user_id===owner).id
  data.practices = data.practices.filter(item => item.id!==practice);data.locations = data.locations.filter(item => item.practice_id!==practice)
  // Empty domain state avoids pre-created patients, appointments or memberships.
  Object.assign(data,{ patientRows: [],patientActivity: [],patientCommands: {},documentRows: [],documentVersions: [],documentEvents: [],documentCommands: {},scheduleRules: {},scheduleCommands: {},scheduleEvents: [],scheduleCommitments: [],scheduleTestDay: doctorAvailabilityToday('Etc/UTC'),appointmentRows: [],appointmentHistory: {},appointmentCommands: {},appointmentRevisions: {} })
}
export function milestoneProtocol({ data,actor,rpc,input,send,owner }) {
  const reject = (code='42501') => { send({ code,message: 'Synthetic milestone command rejected' },400);return true }
  if(rpc==='doctor_save_onboarding_draft') {
    if(data.practices.some(item => item.owner_user_id===actor.id) || data.memberships.some(item => item.user_id===actor.id))return reject()
    const draft = { command_key: input.p_key,display_name: input.p_display_name,practice_name: input.p_practice_name,location_name: input.p_location_name,timezone: input.p_timezone,version: 1 }
    data.milestoneDrafts[actor.id] = draft;send(draft);return true
  }
  if(rpc==='doctor_complete_onboarding') {
    const previous = data.milestoneCompletions[`${actor.id}:${input.p_key}`];if(previous) { send(previous);return true }
    const draft = data.milestoneDrafts[actor.id];if(!draft || draft.command_key!==input.p_key || draft.version!==input.p_draft_version)return reject('40001')
    if(data.practices.some(item => item.owner_user_id===actor.id))return reject()
    const practice = { id: randomUUID(),owner_user_id: actor.id,name: draft.practice_name,version: 1 };const location = { id: randomUUID(),practice_id: practice.id,name: draft.location_name,timezone: draft.timezone,version: 1,contact_phone: '',contact_address: '',archived_at: null }
    data.practices.push(practice);data.locations.push(location);actor.name = draft.display_name;delete data.milestoneDrafts[actor.id];data.milestoneCompleteCalls++
    const result = { practice_id: practice.id,location_id: location.id,version: 1 };data.milestoneCompletions[`${actor.id}:${input.p_key}`] = result;send(result);return true
  }
  if(rpc==='doctor_write_location') {
    if(!owner(input.p_practice))return reject()
    const key = `${actor.id}:${input.p_key}`;if(data.milestoneLocationCommands[key]) { send(data.milestoneLocationCommands[key]);return true }
    let location = input.p_location ? data.locations.find(item => item.id===input.p_location && item.practice_id===input.p_practice) : null
    if(input.p_location && (!location || location.version!==input.p_expected_version || location.archived_at))return reject('40001')
    if(!location) { location = { id: randomUUID(),practice_id: input.p_practice,version: 0,archived_at: null };data.locations.push(location) }
    Object.assign(location,{ name: input.p_name,timezone: input.p_timezone,contact_phone: input.p_phone,contact_address: input.p_address,version: location.version+1 })
    const result = { location_id: location.id,version: location.version };data.milestoneLocationCommands[key] = result;send(result);return true
  }
  return false
}
