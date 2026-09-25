import { z } from 'zod'

export type OperatorJsonValue = null | string | number | boolean | OperatorJsonValue[] | { [key: string]: OperatorJsonValue }
export function asOperatorJson(value: unknown): OperatorJsonValue {
  return JSON.parse(JSON.stringify(value)) as OperatorJsonValue
}

const slug = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/)
const profile = z.enum(['no_ai', 'fast', 'standard', 'deep', 'review'])
const retryProfile = z.enum(['fast', 'standard', 'deep', 'review'])
const jsonRecord = z.record(z.unknown()).default({})

const workstreamSchema = z.object({
  slug,
  display_name: z.string().min(1),
  stack_key: slug,
  application_path: z.string().default(''),
  retry_policy_id: slug.nullish(),
  model_profile: profile.nullish(),
  concurrency_policy: jsonRecord,
  verification_config: jsonRecord,
  publication_config: jsonRecord,
  active: z.boolean().default(true),
  metadata: jsonRecord,
})

export const projectSchema = z.object({
  slug,
  display_name: z.string().min(1),
  repository_path: z.string().min(1),
  github_repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  integration_branch: z.string().min(1),
  production_branch: z.string().min(1),
  local_repository_root: z.string().min(1),
  worktree_root: z.string().min(1),
  application_paths: jsonRecord,
  stack_strategy: jsonRecord,
  allowed_publication_paths: z.array(z.string()).default([]),
  verification_config: jsonRecord,
  local_database_strategy: jsonRecord,
  codex_enabled: z.boolean().default(true),
  default_model_profile: profile.default('standard'),
  retry_policy_id: slug.nullish(),
  concurrency_policy: jsonRecord,
  n8n_metadata: jsonRecord,
  environment_routing: jsonRecord,
  active: z.boolean().default(false),
  metadata: jsonRecord,
  workstreams: z.array(workstreamSchema).min(1),
}).superRefine((value, context) => {
  const sensitive = /^(?:password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|database_url)$/i
  const visit = (item: unknown, path: (string | number)[] = []) => {
    if (!item || typeof item !== 'object') return
    for (const [key, child] of Object.entries(item)) {
      if (sensitive.test(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: [...path, key], message: 'Secrets are not allowed in project configuration' })
      visit(child, [...path, key])
    }
  }
  visit(value)
})

export const retryPolicySchema = z.object({
  policy_id: slug,
  display_name: z.string().min(1),
  max_attempts: z.number().int().min(1).max(20),
  attempt_profiles: z.array(retryProfile),
  active: z.boolean().default(true),
  metadata: jsonRecord,
}).superRefine((value, context) => {
  if (value.attempt_profiles.length !== value.max_attempts) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['attempt_profiles'], message: 'Provide exactly one profile for every attempt' })
  }
})
