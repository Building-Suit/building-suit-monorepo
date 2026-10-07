import { createHash } from 'node:crypto'
import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const sha = value => createHash('sha256').update(value).digest('hex')

export function readBoundArtifact(filename, root) {
  const base = realpathSync(root)
  const target = path.resolve(filename)
  if (!target.startsWith(base + path.sep)) throw new Error('artifact_outside_trusted_root')
  let current = base
  for (const part of path.relative(base, target).split(path.sep)) {
    current = path.join(current, part)
    if (lstatSync(current).isSymbolicLink()) throw new Error('artifact_symlink_refused')
  }
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    if (realpathSync(`/proc/self/fd/${fd}`) !== target) throw new Error('artifact_path_substitution_refused')
    const before = fstatSync(fd)
    if (!before.isFile()) throw new Error('artifact_regular_file_required')
    const bytes = readFileSync(fd)
    const after = fstatSync(fd)
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('artifact_changed_during_read')
    return bytes
  } finally { closeSync(fd) }
}

export function sourceStateFingerprint(root, {head} = {}) {
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (result.status !== 0) throw new Error('source_fingerprint_unavailable')
    return result.stdout
  }
  const files = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).sort()
  const hashes = files.filter(file => !file.startsWith('.local/')).map(file => {
    const filename = path.join(root, file)
    try {
      const stat = lstatSync(filename)
      if (stat.isSymbolicLink()) throw new Error('source_symlink_refused')
      return [file, sha(readBoundArtifact(filename, root))]
    } catch (error) {
      if (error.code === 'ENOENT') return [file, 'deleted']
      throw error
    }
  })
  return sha(JSON.stringify({ head: head ?? git(['rev-parse', 'HEAD']).trim(), files: hashes }))
}

export function commandVersion(check) {
  return sha(JSON.stringify({ name: check.name ?? check.check_name, command: check.command }))
}

export function verifierReceipt({ check, artifactRoot, sourceRoot, executionId, verificationRunId, taskId, runId = null, startedAt, finishedAt }) {
  return {
    version: 2, execution_id: Number(executionId), verification_run_id: Number(verificationRunId),
    task_id: taskId, run_id: runId, check_id: Number(check.verification_id),
    check_name: check.name ?? check.check_name, command: check.command, command_version: commandVersion(check),
    exit_code: check.exit_code, status: check.status, started_at: startedAt, finished_at: finishedAt,
    artifact: { path: check.log_path, sha256: sha(readBoundArtifact(check.log_path, artifactRoot)) },
    source_head: spawnSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).stdout.trim(),
    source_root: realpathSync(sourceRoot), source_fingerprint: sourceStateFingerprint(sourceRoot), failure_phase: check.failure_evidence?.phase ?? 'test',
    result_category: check.failure_evidence?.classification ?? 'UNKNOWN',
    verifier_version: 'trusted-receipt-v2', evidence_generation:Number(verificationRunId),
    registration: check.trusted_registration ?? null, configuration: { selection_reason: check.selection_reason },
  }
}

export function validateTrustedReceipt(evidence, check, { executionId, verificationRunId, artifactRoot, sourceRoot, receipt = check.trusted_receipt, allowTaskPublicationCommit = false } = {}) {
  if (!receipt || !receipt.registration || receipt.registration.version !== 1
    || receipt.registration.check_id !== Number(check.verification_id)
    || receipt.registration.execution_id !== Number(executionId)
    || receipt.registration.verification_run_id !== Number(verificationRunId)
    || receipt.registration.task_id !== receipt.task_id || receipt.registration.run_id !== receipt.run_id
    || receipt.registration.command_id !== (check.name??check.check_name)
    || receipt.registration.command !== check.command || receipt.registration.command_version !== commandVersion(check)
    || !Array.isArray(receipt.registration.obligation_ids) || !receipt.registration.obligation_ids.length
    || !/^[a-f0-9]{64}$/.test(receipt.registration.registry_version??'')
    || !/^[a-f0-9]{64}$/.test(receipt.registration.verifier_sha256??'')
    || receipt.version !== 2 || receipt.check_id !== Number(check.verification_id)
    || receipt.execution_id !== Number(executionId) || receipt.verification_run_id !== Number(verificationRunId)
    || receipt.evidence_generation !== Number(verificationRunId) || receipt.verifier_version !== 'trusted-receipt-v2'
    || JSON.stringify(receipt.registration) !== JSON.stringify(check.trusted_registration??null)
    || receipt.task_id !== (check.task_id??evidence.task_id??receipt.task_id)
    || receipt.run_id !== (check.run_id??evidence.run_id??receipt.run_id)
    || JSON.stringify(evidence.registered_command) !== JSON.stringify(receipt.registration)
    || evidence.task_id !== receipt.task_id || evidence.run_id !== receipt.run_id || evidence.evidence_generation !== receipt.evidence_generation
    || evidence.check_id !== receipt.check_id || evidence.command !== receipt.command
    || evidence.check_name !== receipt.check_name || evidence.exit_code !== receipt.exit_code
    || evidence.source_fingerprint !== receipt.source_fingerprint || receipt.source_root !== realpathSync(sourceRoot)
    || evidence.status !== receipt.status || evidence.artifact?.path !== receipt.artifact?.path
    || evidence.artifact?.sha256 !== receipt.artifact?.sha256 || receipt.command_version !== commandVersion(check)) {
    throw new Error('trusted_verifier_receipt_binding_mismatch')
  }
  if (sha(readBoundArtifact(receipt.artifact.path, artifactRoot)) !== receipt.artifact.sha256) throw new Error('trusted_artifact_digest_mismatch')
  if (sourceStateFingerprint(sourceRoot) !== receipt.source_fingerprint) {
    const ancestor = /^[a-f0-9]{40}$/.test(receipt.source_head ?? '') && spawnSync('git',['merge-base','--is-ancestor',receipt.source_head,'HEAD'],{cwd:sourceRoot}).status===0
    const history = ancestor ? spawnSync('git',['log','--format=%B%x1e',receipt.source_head+'..HEAD'],{cwd:sourceRoot,encoding:'utf8'}) : null
    const commits = history?.status===0 ? history.stdout.split('\x1e').map(body=>body.trim()).filter(Boolean) : []
    if (!allowTaskPublicationCommit || !commits.length || !commits.every(body=>body.split('\n').includes('Task: '+receipt.task_id))
      || sourceStateFingerprint(sourceRoot,{head:receipt.source_head})!==receipt.source_fingerprint) throw new Error('trusted_source_fingerprint_stale')
  }
  for (const source of evidence.review?.source ?? []) {
    if (typeof source.path !== 'string' || path.isAbsolute(source.path) || source.path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '')) throw new Error('reviewed_source_digest_required')
    if (sha(readBoundArtifact(path.join(sourceRoot, source.path), sourceRoot)) !== source.sha256) throw new Error('reviewed_source_digest_stale')
  }
  return receipt
}

export function trustedCommandRegistration({check,executionId,verificationRunId,taskId,runId=null,registry,obligationIds,verifierBytes}) {
 if(!Array.isArray(obligationIds)||!obligationIds.length)throw Error('exact_verification_obligation_required')
 return {version:1,check_id:Number(check.verification_id),execution_id:Number(executionId),verification_run_id:Number(verificationRunId),task_id:taskId,run_id:runId,
  command_id:check.name??check.check_name,command:check.command,command_version:commandVersion(check),registry_version:sha(JSON.stringify(registry)),obligation_ids:obligationIds,verifier_sha256:sha(verifierBytes)}
}

export function validatePassedVerifierCheck(check, context) {
 const receipt=check.trusted_receipt
 if(check.status!=='pass'||!receipt)throw Error('trusted_pass_receipt_required')
 const evidence={...receipt,registered_command:receipt.registration}
 return validateTrustedReceipt(evidence,check,context)
}
