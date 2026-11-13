import type { HqStaffingPlan } from '@building-suit/ui/types/hqLayoutPresentation'

export interface HqStaffingSnapshot {
  version: 1
  canonicalWriter: 'unavailable'
  totalCount: number
  workflows: {
    id: string; sourceTaskId: string; planningTaskId: string | null; status: string; blocker: string; updatedAt: string
    planId: string | null; digest: string | null; plan: HqStaffingPlan | null
    decision: 'approved' | 'rejected' | null; resumeOriginal: boolean | null
  }[]
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = /^[0-9a-f]{64}$/
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).byteLength <= max
  && !Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31
  })
const id = (value: unknown): value is string => typeof value === 'string' && uuid.test(value)
const nullableId = (value: unknown) => value === null || id(value)

/** Explicit founder projection; extra database fields never cross the BFF. */
export function parseHqStaffingSnapshot(value: unknown): HqStaffingSnapshot | null {
  const root = object(value)
  if (root?.version !== 1 || root.canonicalWriter !== 'unavailable' || !Array.isArray(root.workflows) || root.workflows.length > 1000) return null
  const totalCount = root.totalCount ?? root.workflows.length
  if (!Number.isSafeInteger(totalCount) || Number(totalCount) < root.workflows.length || Number(totalCount) > 1000) return null
  const workflows: HqStaffingSnapshot['workflows'] = []
  for (const raw of root.workflows) {
    const row = object(raw)
    if (!row || !id(row.id) || !id(row.sourceTaskId) || !nullableId(row.planningTaskId) || !nullableId(row.planId)
      || !['planning-blocked','planning','approval-required','publication-blocked','rejected','canceled','failed','not-required'].includes(String(row.status))
      || typeof row.blocker !== 'string' || !/^[a-z-]{1,80}$/.test(row.blocker)
      || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt))
      || !(row.digest === null || typeof row.digest === 'string' && hash.test(row.digest))
      || ![null,'approved','rejected'].includes(row.decision as string | null)
      || !(row.resumeOriginal === null || typeof row.resumeOriginal === 'boolean')) return null
    let plan: HqStaffingPlan | null = null
    if (row.plan !== null) {
      const p = object(row.plan), policy = object(p?.modelPolicy), original = object(p?.originalTask)
      if (!p || !original || !text(original.title, 720) || !text(original.brief, 48000) || !text(original.acceptance, 24000) || !row.planId || !row.digest || !text(p.agentId, 40) || !/^AG-[A-Z]+-[0-9]{3}$/.test(p.agentId)
        || !text(p.name, 160) || !text(p.departmentKey, 100) || !text(p.managerId, 40) || p.reviewerId !== 'AG-HR-003'
        || !text(p.profileDraft, 16000) || !text(p.trialCriteria, 4000) || typeof p.resumeOriginal !== 'boolean'
        || !Array.isArray(p.skills) || p.skills.length < 1 || p.skills.length > 10 || !policy
        || policy.model !== 'gpt-6.1-terra' || !['minimal','low','medium','high','xhigh'].includes(String(policy.effort))
        || !text(policy.sourceVersion, 40) || !/^[0-9]+$/.test(policy.sourceVersion)) return null
      const skills: { fileId: string; sourceVersion: string }[] = []
      for (const rawSkill of p.skills) {
        const skill = object(rawSkill)
        if (!skill || !text(skill.fileId, 200) || !/^[A-Za-z0-9_-]{8,200}$/.test(skill.fileId)
          || !text(skill.sourceVersion, 40) || !/^[0-9]+$/.test(skill.sourceVersion)) return null
        skills.push({ fileId: skill.fileId, sourceVersion: skill.sourceVersion })
      }
      if (new Set(skills.map(skill => skill.fileId)).size !== skills.length) return null
      plan = { originalTask: { title: original.title, brief: original.brief, acceptance: original.acceptance }, agentId: p.agentId, name: p.name, departmentKey: p.departmentKey, managerId: p.managerId, reviewerId: p.reviewerId,
        profileDraft: p.profileDraft, skills, modelPolicy: { model: policy.model, effort: String(policy.effort), sourceVersion: policy.sourceVersion },
        trialCriteria: p.trialCriteria, resumeOriginal: p.resumeOriginal }
    }
    else if (row.planId !== null || row.digest !== null || ['approval-required','publication-blocked','rejected'].includes(String(row.status))) return null
    workflows.push({ id: row.id, sourceTaskId: row.sourceTaskId, planningTaskId: row.planningTaskId as string | null,
      status: String(row.status), blocker: row.blocker, updatedAt: row.updatedAt, planId: row.planId as string | null,
      digest: row.digest as string | null, plan, decision: row.decision as 'approved' | 'rejected' | null, resumeOriginal: row.resumeOriginal as boolean | null })
  }
  return { version: 1, canonicalWriter: 'unavailable', totalCount: Number(totalCount), workflows }
}
