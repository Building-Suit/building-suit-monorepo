import { createHash } from 'node:crypto'
import { boundedVerificationReadiness } from '../runner/bounded-verification-readiness.mjs'
import { verificationObligationCapabilities } from '../runner/verification-mode.mjs'

export const BASE_SHA = '3c16c81c3f65d25bcfa82794441b0ee7d2a21588'
const ownership = 'Read root/scoped AGENTS.md, packages/ui/AGENTS.md, docs/shared/ui-ownership.md and docs/shared/atomic-template-route-inventory.json. All presentation, including product-specific screens, belongs in packages/ui; reusable interaction controllers belong in packages/ux. Suits retain business/data/permission logic, typed content/props and semantic commands. Consume one registered complete page template; do not compose local UI. Preserve Solo catalogue/pricing periods, dashboard navigation, shared tabs/card spans and responsive behavior from PR #248.'
const decisions = {
  'SS-APPT-002': ['Separate phase/product approval for public self-booking; public-site V1 continues to prohibit booking.', 'Approved reminder channel and delivery/retention policy.'],
  'SS-SERV-002': ['Concrete approved material units, rounding, effective dates and version/snapshot policy; generic approval text is insufficient.'],
  'SS-SALE-002': ['Concrete approved partial return, refund allocation and stock reconciliation policy; generic approval text is insufficient.'],
  'BS-SA-FUTURE-SUIT-M4-VALIDATION-001': ['Completed SAS-M4-EVENTS-001 and separate bounded integration authorization.'],
  'SHOP-CAS-M1-INT-001': ['Completed CAS-M1-INT-001, exact protected database publication authority and signup/event contract evidence.'],
}

export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
export function firstN(tasks, suit, n) {
  if (!Number.isSafeInteger(n) || n < 1 || n > 20) throw new Error('bounded_count_required')
  return tasks.filter(t => t.suit_slug === suit && !['complete', 'cancelled'].includes(t.status))
    .sort((a, b) => a.priority - b.priority || a.sequence - b.sequence || a.created_at.localeCompare(b.created_at) || a.task_id.localeCompare(b.task_id)).slice(0, n)
}
export function assertAcyclic(edges) {
  const parents = new Map(), visiting = new Set(), visited = new Set()
  for (const edge of edges.filter(e => e.dependency_type === 'hard')) parents.set(edge.task_id, [...(parents.get(edge.task_id) ?? []), edge.depends_on_task_id])
  function visit(id) {
    if (visiting.has(id)) throw new Error(`dependency_cycle:${id}`)
    if (visited.has(id)) return
    visiting.add(id)
    for (const parent of parents.get(id) ?? []) visit(parent)
    visiting.delete(id); visited.add(id)
  }
  for (const id of parents.keys()) visit(id)
}
export function applyReviewedChanges(tasks, changes, executions = []) {
  const byId = new Map(changes.map(c => [c.task_id, c]))
  if (byId.size !== changes.length) throw new Error('duplicate_task_change')
  if (changes.some(c => !tasks.some(t => t.task_id === c.task_id))) throw new Error('task_missing')
  return tasks.map(task => {
    const change = byId.get(task.task_id)
    if (!change) return task
    if (!['shared', 'shop-suit'].includes(task.suit_slug) || task.status !== 'planned' || executions.some(e => e.task_id === task.task_id)) throw new Error('still_unstarted_tasks_only')
    if (Object.keys(change.patch).some(k => !['description', 'priority', 'verification_plan', 'metadata'].includes(k))) throw new Error('protected_field_change')
    if (fingerprint(task) === change.after_fingerprint) return task
    if (fingerprint(task) !== change.before_fingerprint) throw new Error(`concurrent_task_change:${task.task_id}`)
    const result = { ...task, ...structuredClone(change.patch) }
    if (fingerprint(result) !== change.after_fingerprint) throw new Error('reviewed_patch_fingerprint_mismatch')
    return result
  })
}

function classify(entry, task, index, commands) {
  if (entry && typeof entry === 'object') return structuredClone(entry)
  const description = typeof entry === 'string' ? entry : entry.description
  const prefix = task.task_id.toLowerCase(), number = index + 1
  // Research, rendered comparison and human/provider reviews are real evidence gates.
  if (/reference|research|screenshot|before\/after|rendered|manual|operator|approval|safety review|security review|fresh-session|checklist|Read root|links\/paths|only allowed|no DB migrations|report publication/i.test(description)) {
    return { version: 2, kind: 'external_gate', description, required: true, phase: 'pre_publication', blocker: `${prefix}-evidence-${number}-required` }
  }
  if (/^(git diff --check|pnpm typecheck)$/.test(description)) return description
  if (/Run .*checks|Run shared|Run broad|Run relevant docs|Full .*regression.*typecheck|Run Shop\/app/i.test(description)) {
    const refs = task.task_id === 'BS-UI-PRO-001' ? ['readiness-docs-generate', 'workspace-check', 'git-diff-check'] : ['readiness-all-consumer-quality', 'readiness-workspace-tests', 'workspace-check', 'git-diff-check', ...(/database|DB regression|db:test/i.test(description) ? ['readiness-shop-database'] : [])]
    return { version: 2, kind: 'group', description, commands: refs, requires: verificationObligationCapabilities(description) }
  }
  const isShared = task.suit_slug === 'shared'
  const browser = /browser|mobile|bilingual|EN\/AR|Arabic|keyboard|themes|light\/dark|desktop|narrow|responsive/i.test(description)
  const sql = /SQL|\bDB\b|database|FIFO|stock\/payment|receipt\/return/i.test(description)
  const stem = `${prefix}-obligation-${number}`
  const output = isShared ? `packages/ui/tests/${stem}.test.mjs` : browser ? `apps/shop-suit/tests/e2e/${stem}.spec.ts` : sql ? `apps/shop-suit/supabase/tests/${stem}.test.sql` : `apps/shop-suit/tests/unit/${stem}.test.mjs`
  const command = { name: stem, program: browser || sql ? 'pnpm' : 'node', args: browser ? ['exec', 'playwright', 'test', '--config', `apps/shop-suit/tests/e2e/${stem}.config.ts`, '--workers=1', '--retries=0'] : sql ? ['exec', 'supabase', 'test', 'db', '--local', `supabase/tests/${stem}.test.sql`] : ['--test', output], ...(sql ? { cwd: 'apps/shop-suit' } : {}), required: true, capabilities: [...new Set([browser ? 'browser' : sql ? 'database' : 'unit', ...verificationObligationCapabilities(description)])] }
  commands.push(command)
  return { version: 2, kind: 'planned_test', description, commands: [stem], required: true, expected_outputs: [output, ...(browser ? [`apps/shop-suit/tests/e2e/${stem}.config.ts`] : [])] }
}

export function buildReconciliation(snapshot, configuration) {
  assertAcyclic(snapshot.dependencies)
  const commands = [
    { name: 'bs-sa-future-suit-m4-validation-001-unit', program: 'node', args: ['--test', 'packages/contracts/tests/bs-sa-future-suit-m4-validation-001.test.mjs'], required: true, capabilities: ['unit'] },
    { name: 'readiness-all-consumer-quality', program: 'pnpm', args: ['exec', 'turbo', 'run', 'typecheck', 'lint', 'build'], required: true, capabilities: ['typecheck', 'lint', 'build'] },
    { name: 'readiness-shop-database', program: 'pnpm', args: ['db:test:shop'], required: true, capabilities: ['database'] },
    { name: 'readiness-workspace-tests', program: 'pnpm', args: ['test'], required: true, capabilities: ['unit', 'shared-ui', 'shared-ux'] },
    { name: 'readiness-docs-generate', program: 'pnpm', args: ['docs:generate'], required: true, capabilities: ['docs'] },
    { name: 'workspace-check', program: 'pnpm', args: ['check'], required: true, capabilities: ['workspace-boundaries', 'source-ast'] },
    { name: 'git-diff-check', program: 'git', args: ['diff', '--check'], required: true, capabilities: ['diff-check'] },
  ]
  const changes = snapshot.tasks.map(task => {
    if (task.status !== 'planned' || !['shared', 'shop-suit'].includes(task.suit_slug)) throw new Error('still_unstarted_tasks_only')
    const metadata = structuredClone(task.metadata), patch = { description: `${task.description}\n\n${ownership}`, metadata }
    metadata.readiness_reconciliation = { version: 1, base_sha: BASE_SHA, required_reads: ['packages/ui/AGENTS.md', 'docs/shared/ui-ownership.md'], pending_operator_inputs: decisions[task.task_id] ?? [], shared_first: true, protected_scope_approval_required: true }
    if (task.task_id === 'BS-SA-FUTURE-SUIT-M4-VALIDATION-001') patch.priority = 900
    if (task.task_id === 'SHOP-CAS-M1-INT-001') {
      patch.priority = 900
      // Align source scope with signup app code, retaining a separate database gate.
      metadata.source_allowed_paths = [...metadata.allowed_paths]
      metadata.readiness_reconciliation.pending_protected_scopes = ['apps/shop-suit/supabase/**']
    }
    if (task.task_id === 'SS-APPT-002') { patch.priority = 901; patch.description += '\nPublic-site V1 prohibits self-booking. Defer this phase until an explicit product decision approves booking and the reminder channel. No new booking policy is approved by this reconciliation.' }
    if (task.task_id === 'SS-SET-001') patch.priority = 151
    if (task.task_id === 'SS-EGY-ETA-001') patch.priority = 153
    if (task.task_id === 'BS-UI-PRO-003') patch.description = `Refine documented gaps in the existing complete page templates and typed contracts from PR #248. Inventory existing implementations first; do not create a replacement architecture or Suit-local composition. Preserve all route/layout/root ownership.\n\n${ownership}`
    if (task.suit_slug === 'shop-suit' && !task.task_id.startsWith('BS-UI')) {
      // These are candidate task scopes, never an authorization grant.
      const extra = ['packages/ui/src/templates/', 'packages/ui/src/types/', 'packages/ui/tests/', 'packages/ui/package.json', 'packages/ux/src/', 'packages/ux/tests/', 'packages/ux/package.json', 'docs/shared/atomic-template-route-inventory.json', 'docs/shared/ui-ownership-manifest.json']
      metadata.allowed_paths = [...new Set([...metadata.allowed_paths, ...extra])]
      metadata.source_allowed_paths = [...new Set([...(metadata.source_allowed_paths ?? task.metadata.allowed_paths), ...extra])]
      metadata.readiness_reconciliation.shared_scope_transition = 'exact task_shared_package_offer + authenticated operator scope authority before execution; no grant in this artifact'
    }
    if (task.task_id === 'BS-UI-PRO-010') {
      metadata.allowed_paths = ['apps/building-suit-docs/', 'docs/shared/']
      metadata.source_allowed_paths = [...metadata.allowed_paths]
      patch.description += '\nEvidence-only: defects return to their owning workstream; this task may modify only docs/shared and apps/building-suit-docs.'
    }
    const original = [...task.verification_plan]
    if (task.task_id === 'SHOP-CAS-M1-INT-001') original.push('Signup valid/invalid acquisition-reference and policy-acceptance tests.', 'Payment/lifecycle event version, replay, idempotency and retry tests.', 'Shop payment database regression tests.')
    patch.verification_plan = original.map((entry, i) => classify(entry, task, i, commands))
    for (const [i, decision] of (decisions[task.task_id] ?? []).entries()) patch.verification_plan.push({ version: 2, kind: 'external_gate', description: decision, required: true, phase: 'pre_implementation', blocker: `${task.task_id.toLowerCase()}-operator-input-${i + 1}-required` })
    if (task.task_id === 'SS-OFFLINE-001') patch.verification_plan.push({ version: 2, kind: 'external_gate', description: 'Manual authenticated phone/tablet evidence on actual network loss/recovery, replay, rejection recovery and multi-device safety; synthetic tests alone do not satisfy this gate.', required: true, phase: 'pre_publication', blocker: 'ss-offline-001-real-device-network-replay-evidence-required' })
    return { task_id: task.task_id, before_fingerprint: fingerprint(task), after_fingerprint: fingerprint({ ...task, ...patch }), patch }
  })
  const after = applyReviewedChanges(snapshot.tasks, changes)
  const workstreams = configuration.workstreams.map(w => ({ slug: w.slug, before_fingerprint: fingerprint(w), verification_config: { ...w.verification_config, commands: [...w.verification_config.commands, ...commands.filter(c => !w.verification_config.commands.some(old => old.name === c.name))] } }))
  const packets = after.map(task => ({ task, project: { verification_config: snapshot.projects.find(p => p.project_id === task.project_id).verification_config }, workstream: { verification_config: workstreams.find(w => w.slug === task.workstream_slug).verification_config }, dependencies: snapshot.dependencies.filter(d => d.task_id === task.task_id).map(d => ({ task_id: d.depends_on_task_id, dependency_type: d.dependency_type })) }))
  const plans = boundedVerificationReadiness(packets, packets.length)
  // Deduplicate registry snapshots for review. These are reconstructable drafts,
  // not rows that may be submitted to freeze_bounded_verification_plan.
  plans.state = 'CLASSIFIED_DRAFTS_NOT_FROZEN'
  for (const plan of plans.plans) {
    const task = after.find(t => t.task_id === plan.task_id)
    plan.configuration_refs = { project_id: task.project_id, workstream_slug: task.workstream_slug }
    plan.inputs = { verification_plan: plan.inputs.verification_plan }
  }
  return { version: 1, status: 'PROPOSAL_NOT_APPLIED', base_sha: BASE_SHA, source_snapshot_fingerprint: fingerprint(snapshot), changes, workstreams, plans, first_n_before: { shared: firstN(snapshot.tasks, 'shared', 5).map(t => t.task_id), shop: firstN(snapshot.tasks, 'shop-suit', 1).map(t => t.task_id) }, first_n_after: { shared: firstN(after, 'shared', 5).map(t => t.task_id), shop: firstN(after, 'shop-suit', 1).map(t => t.task_id) }, dependencies: snapshot.dependencies, preservation: ['task IDs', 'status', 'acceptance criteria', 'hard dependencies', 'completed/cancelled history', 'retry/model policy', 'runs/executions/credits', 'human/visual/product approvals'], blockers: ['No supported pre-run audited task-amendment operation exposed; no live metadata applied.', 'Exact shared/protected scope authority remains required; proposed paths grant no publication authority.', 'Fresh start-time input snapshots and frozen plans must be prepared by the existing runtime without creating a run in this repair.', 'Unresolved operator/product/external evidence gates remain blocking.'] }
}
