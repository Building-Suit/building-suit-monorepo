import {pathInScope,validPublicationPath} from './publication-preflight.mjs'
// Draft source authority is a control-plane policy, not a fabricated operator receipt.
export function draftSourceArtifact(file) {
 return validPublicationPath(file) && /^(?:apps|packages|docs)\//.test(file) && !/(?:^|\/)(?:\.github|n8n|vercel|deploy)(?:\/|\.|-|$)/i.test(file) && !/(?:^|\/)(?:secrets?|credentials?|\.env)(?:\/|\.|$)/i.test(file)
}
export function queueDraftSourcePaths({authority,task,execution,verification,taskPaths=[],projectPaths=[]}) {
 const p=authority?.draft_source_policy
 if(authority?.authorized!==true || authority.task_id!==task?.task_id || authority.unattended_queue_authority!==true || p?.version!==1 || p.mode!=='verified-source-draft-only' || p.task_id!==task?.task_id || p.run_id!==authority.run_id || Number(p.queue_event)!==Number(authority.queue_authority_event) || Number(p.execution_id)!==Number(execution?.execution_id) || Number(p.verification_run_id)!==Number(verification?.verification_run_id) || verification?.status!=='passed' || Number(verification.execution_id)!==Number(execution?.execution_id) || p.parent_sha!==execution?.parent_sha || p.state_fingerprint!==verification?.state_fingerprint || !/^[0-9a-f]{40}$/.test(execution?.parent_sha??'') || !execution?.branch_name?.startsWith('codex/') || ['main','stg'].includes(execution?.branch_name) || p.merge!==false || p.deploy!==false || p.hosted_sql!==false) return []
 return (verification.verified_state?.files??[]).filter(f=>p.files?.some(b=>b.file===f.file&&b.object===f.object) && pathInScope(f.file,projectPaths) && ((draftSourceArtifact(f.file)&&pathInScope(f.file,taskPaths)) || p.ancillary?.some(b=>b.file===f.file&&b.object===f.object))).map(f=>f.file)
}
