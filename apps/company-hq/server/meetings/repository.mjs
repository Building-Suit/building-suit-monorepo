import { DatabaseSync } from 'node:sqlite'
import { chmodSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { applyCommand, acceptWorkerResult } from '../../shared/meetings/domain.mjs'

const MAX_RECORD_BYTES = 2 * 1024 * 1024
const MAX_MEETINGS = 100
const MAX_QUEUED = 100
const clone = value => JSON.parse(JSON.stringify(value))
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
// Allowlist the admitted scope. Results, event references, reports, attempts and
// review state are mutable lifecycle data and must never change this digest.
const IMMUTABLE_TASK_FIELDS = [
  'id', 'meetingId', 'kind', 'agentId', 'supervisorId', 'question', 'scope',
  'allowedTools', 'allowedActions', 'links', 'deliverable', 'budget',
  'resourceLimits', 'timeoutMs', 'maxAttempts', 'createdAt', 'dependencies',
  'planId', 'planVersion', 'planHash', 'requiredReview', 'acceptanceCriteria',
]
const jobPayload = task => Object.fromEntries(IMMUTABLE_TASK_FIELDS.filter(key => task[key] !== undefined).map(key => [key, task[key]]))
const requiredReviewers = task => task.requiredReview ?? [...new Set([task.supervisorId, 'AG-CEO-001'])]
const reviewsAccepted = (task, reviews) => requiredReviewers(task).every(id => Object.values(reviews ?? {}).some(review => review.reviewerId === id && review.verdict === 'accepted'))

export class MeetingRepositoryError extends Error {
  constructor(code) { super(code); this.code = code }
}
const fail = code => { throw new MeetingRepositoryError(code) }
function boundedRecord(record) {
  const json = JSON.stringify(record)
  if (Buffer.byteLength(json) > MAX_RECORD_BYTES) fail('meeting-limit')
  return json
}
function identity(value) {
  // eslint-disable-next-line no-control-regex -- Identity values must contain no control bytes.
  if (typeof value !== 'string' || !value || value.length > 200 || /[\u0000-\u001f]/.test(value)) fail('invalid-identity')
  return value
}

/**
 * Disposable, synthetic persistence only. This is deliberately not a live HQ
 * authority or a second production database. Live operational data belongs to
 * the existing HQ Supabase boundary. No environment variable enables this API.
 */
export function createSyntheticMeetingRepository({ filename, synthetic, now = () => Date.now() }) {
  if (synthetic !== true || !isAbsolute(filename) || filename === ':memory:') fail('synthetic-repository-required')
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(filename)
  chmodSync(filename, 0o600)
  // Configure waiting before WAL/schema operations can compete with another
  // preview process opening this same disposable database for the first time.
  database.exec('pragma busy_timeout=5000;')
  database.exec(`
    pragma journal_mode=WAL;
    pragma foreign_keys=ON;
    create table if not exists fixture_meta (name text primary key, value text not null);
    insert or ignore into fixture_meta values ('mode','synthetic-meetings-v1');
    create table if not exists meetings (
      id text primary key, owner text not null, revision integer not null,
      record text not null, created_at integer not null, updated_at integer not null
    );
    create table if not exists jobs (
      id text primary key, meeting_id text not null references meetings(id) on delete cascade,
      owner text not null, payload text not null, fingerprint text not null,
      status text not null check(status in ('queued','running','completed','failed','cancelled')),
      generation integer not null, attempts integer not null default 0,
      max_attempts integer not null, timeout_ms integer not null,
      lease_token text, lease_owner text, lease_until integer, deadline integer,
      heartbeat_at integer, result text, review text, last_error text,
      unique(meeting_id,id)
    );
    create index if not exists fixture_jobs_pending on jobs(status,lease_until);
    create table if not exists mutations (
      meeting_id text not null references meetings(id) on delete cascade,
      request_id text not null, fingerprint text not null, record text not null,
      primary key(meeting_id,request_id)
    );
  `)
  if (database.prepare("select value from fixture_meta where name='mode'").get()?.value !== 'synthetic-meetings-v1') fail('fixture-database-mismatch')

  function transaction(callback) {
    database.exec('begin immediate')
    try { const result = callback(); database.exec('commit'); return result }
    catch (error) { database.exec('rollback'); throw error }
  }
  function rowFor(owner, meetingId) {
    identity(owner); identity(meetingId)
    const row = database.prepare('select * from meetings where id=? and owner=?').get(meetingId, owner)
    if (!row) fail('meeting-not-found')
    return row
  }
  function syncJobs(owner, record) {
    for (const task of record.tasks ?? []) {
      const existing = database.prepare('select * from jobs where id=?').get(task.id)
      const payload = jobPayload(task), fingerprint = digest(payload)
      if (existing) {
        if (existing.meeting_id !== record.id || existing.owner !== owner || existing.fingerprint !== fingerprint) fail('task-scope-changed')
        if (task.status === 'cancelled' && existing.status !== 'cancelled') {
          database.prepare("update jobs set status='cancelled',generation=?,lease_token=null,lease_owner=null,lease_until=null where id=?").run(task.generation, task.id)
        }
        continue
      }
      if (task.status !== 'queued') continue
      if (task.budget !== 0 || task.resourceLimits?.concurrency !== 1 || task.timeoutMs < 1000 || task.timeoutMs > 300000) fail('invalid-task-limits')
      if (database.prepare("select count(*) as count from jobs where status in ('queued','running')").get().count >= MAX_QUEUED) fail('queue-limit')
      database.prepare(`insert into jobs (id,meeting_id,owner,payload,fingerprint,status,generation,max_attempts,timeout_ms)
        values (?,?,?,?,?,'queued',?,?,?)`).run(task.id, record.id, owner, JSON.stringify(payload), fingerprint, task.generation, Math.min(2, task.maxAttempts ?? 2), task.timeoutMs)
    }
  }
  function write(owner, record) {
    const json = boundedRecord(record)
    database.prepare('update meetings set record=?,revision=?,updated_at=? where id=? and owner=?')
      .run(json, record.revision, now(), record.id, owner)
    syncJobs(owner, record)
    return clone(record)
  }
  function create(owner, record) {
    identity(owner); identity(record?.id)
    if (record.founderId !== owner || record.mode !== 'demonstration') fail('synthetic-owner-required')
    return transaction(() => {
      if (database.prepare('select count(*) as count from meetings where owner=?').get(owner).count >= MAX_MEETINGS) fail('meeting-limit')
      if (database.prepare('select id from meetings where id=?').get(record.id)) fail('meeting-already-exists')
      database.prepare('insert into meetings values (?,?,?,?,?,?)').run(record.id, owner, record.revision, boundedRecord(record), now(), now())
      syncJobs(owner, record)
      return clone(record)
    })
  }
  function command(owner, meetingId, input, { requestId = randomUUID(), expectedRevision } = {}) {
    identity(requestId)
    const fingerprint = digest(input)
    return transaction(() => {
      const row = rowFor(owner, meetingId)
      const receipt = database.prepare('select * from mutations where meeting_id=? and request_id=?').get(meetingId, requestId)
      if (receipt) {
        if (receipt.fingerprint !== fingerprint) fail('request-conflict')
        // The command's effect is already committed. Return the latest meeting
        // projection so a retry cannot roll the UI behind subsequent findings.
        return JSON.parse(row.record)
      }
      if (expectedRevision !== undefined && row.revision !== expectedRevision) fail('revision-conflict')
      const record = applyCommand(JSON.parse(row.record), input, { actorId: owner, kind: 'founder', now: new Date(now()).toISOString(), id: requestId })
      const result = write(owner, record)
      database.prepare('insert into mutations values (?,?,?,?)').run(meetingId, requestId, fingerprint, boundedRecord(result))
      return result
    })
  }
  function save(owner, record, { expectedRevision } = {}) {
    return transaction(() => {
      const row = rowFor(owner, record.id)
      if (record.founderId !== owner || record.mode !== 'demonstration' || expectedRevision !== row.revision) fail('revision-conflict')
      return write(owner, record)
    })
  }
  function get(owner, meetingId) { return JSON.parse(rowFor(owner, meetingId).record) }
  function list(owner) {
    identity(owner)
    return database.prepare('select record from meetings where owner=? order by updated_at desc limit ?').all(owner, MAX_MEETINGS).map(row => JSON.parse(row.record))
  }
  function jobs(owner, meetingId) {
    rowFor(owner, meetingId)
    return database.prepare('select id,status,generation,attempts,lease_until,deadline,result,review,last_error from jobs where meeting_id=? and owner=?').all(meetingId, owner).map(row => ({
      id: row.id, status: row.status, generation: row.generation, attempts: row.attempts,
      leaseUntil: row.lease_until, deadline: row.deadline, result: row.result ? JSON.parse(row.result) : null,
      review: row.review ? JSON.parse(row.review) : null, error: row.last_error,
    }))
  }
  function workerEvent(row, input, key) {
    const meeting = JSON.parse(rowFor(row.owner, row.meeting_id).record)
    const record = input.type === 'worker-result'
      ? acceptWorkerResult(meeting, input.result, { actorId: row.lease_owner ?? 'fixture-worker', kind: 'worker', now: new Date(now()).toISOString(), id: key })
      : applyCommand(meeting, input, { actorId: row.lease_owner ?? 'fixture-worker', kind: 'worker', now: new Date(now()).toISOString(), id: key })
    return write(row.owner, record)
  }
  function claim(workerId, { leaseMs = 10000 } = {}) {
    identity(workerId)
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 100 || leaseMs > 30000) fail('invalid-lease')
    return transaction(() => {
      // One measured worker slot across all fixture meetings. Expired leases
      // can be reclaimed; old tokens never gain permission to finish/review.
      if (database.prepare("select id from jobs where status='running' and lease_until>?").get(now())) return null
      const candidates = database.prepare("select * from jobs where status='queued' or (status='running' and lease_until<=?) order by rowid limit 100").all(now())
      for (const row of candidates) {
        const payload = JSON.parse(row.payload)
        let meeting = JSON.parse(rowFor(row.owner, row.meeting_id).record)
        let task = meeting.tasks?.find(item => item.id === row.id)
        if (!task || task.status === 'cancelled') {
          database.prepare("update jobs set status='cancelled',lease_token=null,lease_until=null where id=?").run(row.id)
          continue
        }
        if (row.attempts >= row.max_attempts || (row.deadline !== null && row.deadline <= now())) {
          database.prepare("update jobs set status='failed',lease_token=null,lease_until=null,last_error=? where id=?").run('lease-or-task-timeout', row.id)
          if (task.status === 'running') workerEvent(row, { type: 'worker-result', result: { taskId: row.id, generation: row.generation, status: 'failed', error: 'lease-or-task-timeout' } }, randomUUID())
          continue
        }
        const dependencies = payload.dependencies ?? []
        if (dependencies.some(id => {
          const dependency = database.prepare('select status,review,payload from jobs where id=? and meeting_id=?').get(id, row.meeting_id)
          if (dependency?.status !== 'completed') return true
          if (JSON.parse(dependency.payload).kind !== 'execution') return false
          if (!dependency.review) return true
          return !reviewsAccepted(JSON.parse(dependency.payload), JSON.parse(dependency.review))
        })) continue
        if (task.status === 'running') {
          meeting = workerEvent(row, { type: 'retry-task', taskId: row.id, generation: row.generation }, randomUUID())
          task = meeting.tasks.find(item => item.id === row.id)
        }
        const generation = task.generation
        const token = randomUUID(), deadline = row.deadline ?? now() + row.timeout_ms
        database.prepare("update jobs set status='running',generation=?,attempts=attempts+1,lease_token=?,lease_owner=?,lease_until=?,deadline=?,heartbeat_at=? where id=?")
          .run(generation, token, workerId, Math.min(now() + leaseMs, deadline), deadline, now(), row.id)
        const updated = { ...row, generation, lease_owner: workerId }
        workerEvent(updated, { type: 'worker-accepted', taskId: row.id, generation }, `claim:${token}`)
        return { id: row.id, meetingId: row.meeting_id, ownerId: row.owner, generation, token, workerId, deadline, attempt: row.attempts + 1, payload }
      }
      return null
    })
  }
  function leased(lease) {
    const row = database.prepare("select * from jobs where id=? and status='running' and lease_token=? and lease_owner=? and generation=? and lease_until>? and deadline>?")
      .get(lease.id, lease.token, lease.workerId, lease.generation, now(), now())
    if (!row) fail('stale-lease')
    return row
  }
  function heartbeat(lease, { leaseMs = 10000 } = {}) {
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 100 || leaseMs > 30000) fail('invalid-lease')
    return transaction(() => {
      const row = leased(lease)
      database.prepare('update jobs set lease_until=?,heartbeat_at=? where id=?').run(Math.min(now() + leaseMs, row.deadline), now(), row.id)
      return true
    })
  }
  function complete(lease, output) {
    return transaction(() => {
      const row = leased(lease)
      const result = { ...output, taskId: row.id, generation: row.generation }
      if (!['completed', 'failed', 'cancelled'].includes(result.status) || Buffer.byteLength(JSON.stringify(result)) > 65536) fail('invalid-result')
      const record = workerEvent(row, { type: 'worker-result', result }, `result:${lease.token}`)
      database.prepare('update jobs set status=?,result=?,last_error=?,lease_token=null,lease_until=null where id=?')
        .run(result.status, JSON.stringify(result), result.error ?? null, row.id)
      return record
    })
  }
  function review(owner, meetingId, taskId, { reviewerId, stage, verdict, evidence, requestId = randomUUID() }) {
    identity(reviewerId); identity(requestId)
    if (stage !== undefined && !['supervisor', 'steve'].includes(stage) || !['accepted', 'revision-required', 'rejected'].includes(verdict)
      || typeof evidence !== 'string' || !evidence.trim() || evidence.length > 8000) fail('invalid-review')
    return transaction(() => {
      const meeting = JSON.parse(rowFor(owner, meetingId).record)
      const task = meeting.tasks?.find(item => item.id === taskId)
      const row = database.prepare('select * from jobs where id=? and meeting_id=? and owner=?').get(taskId, meetingId, owner)
      if (!row || row.status !== 'completed' || !row.result || !task) fail('result-not-reviewable')
      const reviews = row.review ? JSON.parse(row.review) : {}
      const chain = requiredReviewers(task)
      const old = Object.values(reviews).find(review => review.reviewerId === reviewerId)
      if (old) {
        if (old.requestId !== requestId || old.verdict !== verdict || old.evidence !== evidence) fail('review-conflict')
        return old
      }
      if (Object.values(reviews).some(review => review.verdict !== 'accepted')) fail('review-already-rejected')
      const expectedReviewer = chain.find(id => !Object.values(reviews).some(review => review.reviewerId === id && review.verdict === 'accepted'))
      if (reviewerId === 'AG-CEO-001' && expectedReviewer !== reviewerId && chain.includes(reviewerId)) fail('supervisor-review-required')
      if (reviewerId !== expectedReviewer || reviewerId === task.agentId || reviewerId === row.lease_owner
        || !meeting.participants.some(item => item.id === reviewerId)) fail('independent-review-required')
      stage = reviewerId === meeting.chairId ? 'steve' : 'supervisor'
      const receipt = { reviewerId, stage, verdict, evidence, requestId, resultDigest: digest(JSON.parse(row.result)), at: new Date(now()).toISOString(), synthetic: true }
      database.prepare('update jobs set review=? where id=?').run(JSON.stringify({ ...reviews, [stage]: receipt }), taskId)
      if (task.kind === 'execution') {
        const updated = applyCommand(meeting, { type: 'review-task', taskId, decision: verdict === 'accepted' ? 'accepted' : 'rejected', note: evidence }, {
          actorId: reviewerId, kind: 'worker', id: `review:${requestId}`, now: new Date(now()).toISOString(),
        })
        write(owner, updated)
      }
      return receipt
    })
  }
  function cancel(owner, meetingId, taskId, options) { return command(owner, meetingId, { type: 'cancel-task', taskId }, options) }
  function remove(owner, meetingId) {
    return transaction(() => { rowFor(owner, meetingId); database.prepare('delete from meetings where id=? and owner=?').run(meetingId, owner); return true })
  }
  function report(owner, meetingId) {
    const meeting = JSON.parse(rowFor(owner, meetingId).record)
    return jobs(owner, meetingId).map(job => ({
      taskId: job.id, status: job.status, result: job.result, reviews: job.review,
      readyForFounder: reviewsAccepted(meeting.tasks.find(task => task.id === job.id), job.review),
      destination: 'AG-CEO-001', synthetic: true,
    }))
  }
  /** Internal fixture-reviewer queue. Never expose this cross-owner method in a web API. */
  function pendingReviews(limit = 32) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32) fail('invalid-review-limit')
    const rows = database.prepare(`select j.* from jobs j where j.status='completed'
      and json_extract(j.payload,'$.kind')='execution'
      and not exists(select 1 from json_each(coalesce(j.review,'{}')) r where json_extract(r.value,'$.verdict')<>'accepted')
      and json_array_length(j.payload,'$.requiredReview')>(select count(*) from json_each(coalesce(j.review,'{}')))
      order by j.rowid limit ?`).all(limit)
    return rows.map(row => {
      const record = JSON.parse(rowFor(row.owner, row.meeting_id).record)
      const task = record.tasks.find(task => task.id === row.id)
      const reviews = row.review ? JSON.parse(row.review) : {}
      const reviewerId = requiredReviewers(task).find(id => !Object.values(reviews).some(review => review.reviewerId === id && review.verdict === 'accepted'))
      return { ownerId: row.owner, meetingId: row.meeting_id, taskId: row.id, reviewerId, mode: record.mode, task: clone(task), result: JSON.parse(row.result), reviews }
    })
  }
  return { create, load: get, get, list, save, command, claim, heartbeat, complete, cancel, review, report, pendingReviews, jobs, delete: remove, close: () => database.close() }
}
