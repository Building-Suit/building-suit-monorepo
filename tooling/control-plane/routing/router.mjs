import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

const config = JSON.parse(
  readFileSync(
    path.join(here, 'models.json'),
    'utf8',
  ),
)

const allowedProfiles = new Set(
  Object.keys(config.profiles),
)

export function listProfiles() {
  return [...allowedProfiles]
}

export function getProfile(profile) {
  if (!allowedProfiles.has(profile)) {
    throw new Error(
      `Unknown model profile: ${profile}`,
    )
  }

  return {
    profile,
    ...config.profiles[profile],
  }
}

function supportedEfforts(model) {
  return (
    model.supportedReasoningEfforts ?? []
  )
    .map(option => option.reasoningEffort)
    .filter(Boolean)
}

export function resolveProfile(
  profile,
  availableModels = [],
) {
  const requested = getProfile(profile)

  if (!requested.uses_codex) {
    return {
      ...requested,
      model: null,
      reasoning_effort: null,
      resolution: 'no_ai',
    }
  }

  const visibleModels = availableModels.filter(
    model => model.hidden !== true,
  )

  if (visibleModels.length === 0) {
    throw new Error(
      'No ChatGPT-authenticated Codex models are available.',
    )
  }

  let selectedModel = null
  let resolution = null

  for (
    const preferredModel
    of requested.model_preferences ?? []
  ) {
    selectedModel = visibleModels.find(
      candidate =>
        candidate.model === preferredModel ||
        candidate.id === preferredModel,
    )

    if (selectedModel) {
      resolution = 'preferred'
      break
    }
  }

  if (!selectedModel) {
    selectedModel = visibleModels.find(
      candidate => candidate.isDefault === true,
    )

    if (selectedModel) {
      resolution = 'account_default'
    }
  }

  if (!selectedModel) {
    throw new Error(
      [
        `No suitable Codex model could be resolved`,
        `for profile "${profile}".`,
        `The account returned ${visibleModels.length}`,
        `visible model(s), but none matched`,
        `the configured preferences and no`,
        `account default was advertised.`,
      ].join(' '),
    )
  }

  const supported =
    supportedEfforts(selectedModel)

  let reasoningEffort =
    requested.reasoning_effort

  if (
    reasoningEffort &&
    supported.length > 0 &&
    !supported.includes(reasoningEffort)
  ) {
    reasoningEffort =
      selectedModel.defaultReasoningEffort ??
      supported[0]
  }

  return {
    profile,

    uses_codex: true,

    model:
      selectedModel.model ??
      selectedModel.id,

    display_name:
      selectedModel.displayName ?? null,

    reasoning_effort:
      reasoningEffort ??
      selectedModel.defaultReasoningEffort ??
      null,

    supported_reasoning_efforts:
      supported,

    is_account_default:
      selectedModel.isDefault === true,

    resolution,

    description:
      requested.description,
  }
}
