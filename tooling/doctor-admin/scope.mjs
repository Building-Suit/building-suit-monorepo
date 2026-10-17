import { createHash } from 'node:crypto'

export const sourceHead = '4ca7110f4d6efa828e0b41213e5c059bf02ba9db'
const forbidden = ['clinical-records', 'prescriptions', 'diagnosis-or-dose-advice', 'private-document-uploads', 'clinical-or-free-text-notes', 'imports', 'outbound-messages', 'patient-charges-and-collections', 'mobile-apps', 'unapproved-paid-or-real-user-activation']

/** Reference validation only: this function cannot grant domain/release approval. */
export function validateAdministrativeScope(scope, sources) {
  const errors = []
  if (scope.schemaVersion !== 1 || scope.editionId !== 'doctor-administrative-early' || scope.scopeStatus !== 'implementation-authorized-live-activation-blocked') errors.push('edition-identity')
  if (scope.authority?.sourceHead !== sourceHead || scope.authority?.originalPlansRemainUncompletedByThisEdition !== true || scope.authority?.automationImportOrActivationAuthorized !== false) errors.push('authority')
  if (scope.commercialTerms !== null) errors.push('invented-commercial-terms')
  if (forbidden.some(value => !scope.excluded?.includes(value)) || scope.included?.some(value => forbidden.includes(value))) errors.push('edition-exclusions')
  if (scope.sources?.length !== 9) errors.push('source-count')
  const sourceTasks = new Set()
  const sourceRequirements = new Set()
  for (let n = 1; n <= 9; n++) {
    const id = `DOS-M${n}`
    const records = scope.sources?.filter(row => row.milestone === id) || []
    const content = sources.get(id)
    const path = `docs/work-packages/doctor-suit/planning-v0.4/${id}.json`
    if (records.length !== 1 || records[0].path !== path || !content || records[0].fileSha256 !== createHash('sha256').update(content).digest('hex')) errors.push(`source-drift:${id}`)
    if (content) {
      const plan = JSON.parse(content)
      plan.tasks.forEach(task => sourceTasks.add(task.task_id))
      plan.requirements.forEach(requirement => sourceRequirements.add(requirement.requirement_id))
    }
  }
  const tasks = scope.tasks || []
  const ids = new Set(tasks.map(task => task.taskId))
  const cases = new Set()
  if (tasks.length !== 11 || ids.size !== 11) errors.push('task-count')
  for (const [index, task] of tasks.entries()) {
    const expected = `DOS-AE-${String(index + 1).padStart(3, '0')}`
    if (task.taskId !== expected || task.initialStatus !== 'planned') errors.push(`task-identity:${expected}`)
    if (!task.acceptance?.length || !task.sourceTaskIds?.length || !task.sourceRequirementIds?.length) errors.push(`coverage:${expected}`)
    if (task.sourceTaskIds?.some(id => !sourceTasks.has(id)) || task.sourceRequirementIds?.some(id => !sourceRequirements.has(id))) errors.push(`source-reference:${expected}`)
    for (const [number, test] of (task.acceptance || []).entries()) {
      const id = `${expected}-C${String(number + 1).padStart(2, '0')}`
      if (test.caseId !== id || cases.has(id) || typeof test.assertion !== 'string' || !test.assertion.trim()) errors.push(`acceptance:${id}`)
      cases.add(id)
    }
    if (task.dependsOn?.some(id => !ids.has(id) || id === task.taskId)) errors.push(`dependency:${expected}`)
  }
  const visiting = new Set()
  const visited = new Set()
  function visit(id) {
    if (visiting.has(id)) { errors.push(`cycle:${id}`); return }
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of tasks.find(task => task.taskId === id)?.dependsOn || []) if (ids.has(dependency)) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  ids.forEach(visit)
  const decisions = scope.decisions || []
  if (decisions.length !== 10 || decisions[0]?.decisionId !== 'DOS-AE-D01' || decisions[0]?.status !== 'resolved') errors.push('decision-identity')
  const pending = decisions.slice(1)
  if (pending.some((row, index) => row.decisionId !== `DOS-AE-D${String(index + 2).padStart(2, '0')}` || row.status !== 'pending')) errors.push('unapproved-domain-gate')
  if (scope.liveActivationRequires?.length !== 9 || pending.some(row => !scope.liveActivationRequires?.includes(row.decisionId))) errors.push('live-gate-coverage')
  return errors
}
