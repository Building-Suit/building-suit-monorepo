// Synthetic own-account protocol only. SQL separately verifies admission and RLS.
import{randomUUID}from'node:crypto'
const view=row=>({id:row.id,kind:row.kind,state:row.state,created_at:row.created_at})
export function privacyProtocol({data,actor,rpc,input,send}){
 if(!['doctor_privacy_requests','doctor_submit_privacy_request'].includes(rpc))return false
 data.privacyRequests??={};const own=data.privacyRequests[actor.id]??(data.privacyRequests[actor.id]=[])
 if(rpc==='doctor_privacy_requests'){send({user_id:actor.id,scope:'own_account',data_mode:'synthetic',policy_configured:false,fulfillment_available:false,items:own.map(view)});return true}
 const kinds=['access_review','correction_review','erasure_review','restriction_review'],prior=own.find(row=>row.key===input.p_key)
 if(!kinds.includes(input.p_kind)){send({code:'22023'},400);return true}
 if(prior&&prior.kind!==input.p_kind){send({code:'40001'},409);return true}
 let row=prior??own.find(row=>row.kind===input.p_kind);if(!row){row={id:randomUUID(),key:input.p_key,kind:input.p_kind,state:'awaiting_review',created_at:new Date().toISOString()};own.push(row)}send(view(row));return true
}
