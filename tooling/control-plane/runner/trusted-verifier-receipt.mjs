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

export function sourceStateFingerprint(root) {
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
  return sha(JSON.stringify({ head: git(['rev-parse', 'HEAD']).trim(), files: hashes }))
}

export function commandVersion(check) {
  return sha(JSON.stringify({ name: check.name ?? check.check_name, command: check.command }))
}

export function verifierReceipt({ check, artifactRoot, sourceRoot, executionId, verificationRunId, taskId, runId = null, startedAt, finishedAt }) {
  return {
    version: 1, execution_id: Number(executionId), verification_run_id: Number(verificationRunId),
    task_id: taskId, run_id: runId, check_id: Number(check.verification_id),
    check_name: check.name ?? check.check_name, command: check.command, command_version: commandVersion(check),
    exit_code: check.exit_code, status: check.status, started_at: startedAt, finished_at: finishedAt,
    artifact: { path: check.log_path, sha256: sha(readBoundArtifact(check.log_path, artifactRoot)) },
    source_root: realpathSync(sourceRoot), source_fingerprint: sourceStateFingerprint(sourceRoot), failure_phase: check.failure_evidence?.phase ?? 'test',
    result_category: check.failure_evidence?.classification ?? 'UNKNOWN',
    verifier_version: 'trusted-receipt-v1', configuration: { selection_reason: check.selection_reason },
  }
}

export function validateTrustedReceipt(evidence, check, { executionId, verificationRunId, artifactRoot, sourceRoot, receipt = check.trusted_receipt } = {}) {
  if (!receipt || receipt.version !== 1 || receipt.check_id !== Number(check.verification_id)
    || receipt.execution_id !== Number(executionId) || receipt.verification_run_id !== Number(verificationRunId)
    || evidence.check_id !== receipt.check_id || evidence.command !== receipt.command
    || evidence.check_name !== receipt.check_name || evidence.exit_code !== receipt.exit_code
    || evidence.source_fingerprint !== receipt.source_fingerprint || receipt.source_root !== realpathSync(sourceRoot)
    || evidence.status !== receipt.status || evidence.artifact?.path !== receipt.artifact?.path
    || evidence.artifact?.sha256 !== receipt.artifact?.sha256 || receipt.command_version !== commandVersion(check)) {
    throw new Error('trusted_verifier_receipt_binding_mismatch')
  }
  if (sha(readBoundArtifact(receipt.artifact.path, artifactRoot)) !== receipt.artifact.sha256) throw new Error('trusted_artifact_digest_mismatch')
  if (sourceStateFingerprint(sourceRoot) !== receipt.source_fingerprint) throw new Error('trusted_source_fingerprint_stale')
  for (const source of evidence.review?.source ?? []) {
    if (typeof source.path !== 'string' || path.isAbsolute(source.path) || source.path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '')) throw new Error('reviewed_source_digest_required')
    if (sha(readBoundArtifact(path.join(sourceRoot, source.path), sourceRoot)) !== source.sha256) throw new Error('reviewed_source_digest_stale')
  }
  return receipt
}
