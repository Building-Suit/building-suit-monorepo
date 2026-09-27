import type { JsonValue } from './dashboard'

export interface ProjectRow {
  project_id: string
  slug: string
  display_name: string
  github_repository: string
  integration_branch: string
  production_branch: string
  local_repository_root: string
  worktree_root: string
  codex_enabled: boolean
  default_model_profile: string
  retry_policy_id: string | null
  concurrency_policy: Record<string, JsonValue>
  active: boolean
}

export interface WorkstreamRow {
  project_id: string
  project_slug: string
  slug: string
  display_name: string
  stack_key: string
  application_path: string | null
  suit_slug: string | null
  retry_policy_id: string | null
  model_profile: string | null
  concurrency_policy: Record<string, JsonValue>
  active: boolean
}

export interface RetryPolicyRow {
  policy_id: string
  display_name: string
  max_attempts: number
  attempt_profiles: string[]
  active: boolean
  updated_at: string
}
