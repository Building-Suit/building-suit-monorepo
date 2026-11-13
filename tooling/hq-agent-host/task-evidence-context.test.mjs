/** Source-contract checks only; executable SQL/claim acceptance requires disposable PostgreSQL. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const root = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
const sql = await readFile(new URL('./proposed-migrations/hq_task_evidence_context.sql', import.meta.url), 'utf8')
const base = await readFile(new URL('20261105204244_hq_hr_output_supervisor_recovery.sql', root), 'utf8')
const helper = sql.slice(sql.indexOf('create function'), sql.indexOf('revoke all'))
test('single exact pre-lease anchor preserves claim authorization and function identity', () => {
  const anchor = "  if octet_length(v_context::text)>245760 then return hq_private.workforce_block_claim(v_job,'context-capacity'); end if;"
  assert.equal(base.split(anchor).length - 1, 1)
  const claim = base.slice(base.indexOf('create or replace function hq_private.worker_claim'))
  assert.ok(claim.indexOf(anchor) < claim.indexOf("set status='working',worker_id"))
  assert.match(sql, /worker_claim_before_meetings\(uuid,integer\)/)
  assert.match(sql, /\/length\(v_anchor\)<>1/)
  assert.match(sql, /execute replace\(v_definition,v_anchor,/)
  assert.doesNotMatch(sql, /alter function|grant execute|create or replace function hq_private.worker_claim/)
})
test('only ordinary repair, review and report receive task-local context; trials unchanged', () => {
  assert.match(helper, /p_job.kind not in \('task-work','head-review','ceo-review','task-report'\)/)
  assert.match(helper, /exists\(select 1 from hq_private.workforce_trials where task_id=p_job.task_id\)/)
  assert.match(helper, /id=p_job.task_id and founder_user_id=p_job.founder_user_id/)
  assert.match(helper, /conversation_id=p_job.conversation_id and founder_message_id=p_job.founder_message_id/)
  assert.equal((helper.match(/j.founder_user_id=p_job.founder_user_id/g) || []).length, 2)
  assert.equal((helper.match(/j.conversation_id=p_job.conversation_id/g) || []).length, 2)
  assert.match(helper, /x.task_id=v_task.id and x.founder_user_id=p_job.founder_user_id/)
})
test('prior native evidence keeps all original identities and completed source-job provenance', () => {
  assert.match(helper, /'id',a.id,'jobId',a.job_id/)
  assert.match(helper, /'agentId',a.agent_id,'kind',a.kind,'digest',a.digest/)
  assert.match(helper, /r.artifact_id=a.id and r.artifact_digest=a.digest and r.job_id=a.job_id/)
  assert.match(helper, /j.id=x.job_id and j.task_id=x.task_id/)
  assert.match(helper, /j.status='completed'/)
  assert.doesNotMatch(helper, /artifact,toolEvidence|insert into|update public|update hq_private|delete from/i)
})
test('current qualifications stay subject-specific and use authoritative helpers', () => {
  assert.match(helper, /'qualification',hq_private.workforce_qualification_context\(v_task.assignee_id\)/)
  assert.match(helper, /'qualified',hq_private.workforce_agent_qualified\(v_task.assignee_id\)/)
  assert.match(helper, /'authorQualification',hq_private.workforce_qualification_context\(v_artifact.agent_id\)/)
  assert.match(helper, /'authorQualified',hq_private.workforce_agent_qualified\(v_artifact.agent_id\)/)
  assert.doesNotMatch(helper, /'status','qualified'|not_qualified|enabled\s*=\s*true/)
})
test('delegations are actual completed task route/ack results, bounded and explicitly incomplete', () => {
  assert.match(helper, /x.kind in \('task-route','task-ack'\) and x.status='completed'/)
  assert.match(helper, /'delegateId',j.result_text::jsonb->'delegateId'/)
  assert.match(helper, /'assigneeId',j.result_text::jsonb->'assigneeId'/)
  assert.equal((helper.match(/limit 11/g) || []).length, 2)
  assert.match(helper, /jsonb_array_length\(v_history\)>10 or octet_length\(v_history::text\)>81920/)
  assert.match(helper, /jsonb_array_length\(v_delegations\)>10 or octet_length\(v_delegations::text\)>81920/)
  assert.match(helper, /'taskHistoryTruncated',v_history_truncated,'taskDelegationsTruncated',v_delegations_truncated/)
  assert.match(helper, /exit when octet_length\(v_context::text\)<=245760/)
  assert.match(helper, /v_history:=v_history-0; v_history_truncated:=true/)
})
test('new helper is private, fixed-search-path and has no new caller permissions', () => {
  assert.match(sql, /language plpgsql security definer set search_path=''/)
  assert.match(sql, /revoke all on function hq_private.task_evidence_context\(public.hq_agent_jobs,jsonb\)\s+from public,anon,authenticated,service_role/)
  assert.doesNotMatch(sql, /grant |create table|create trigger/i)
})
