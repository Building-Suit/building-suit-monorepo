const supportedModes = new Set([
  'focused',
  'milestone',
  'release',
])

export function resolveVerificationMode(packet) {
  const configured =
    packet.task?.verification_mode ??
    packet.task?.metadata?.verification_mode ??
    packet.workstream?.verification_config?.mode ??
    packet.project?.verification_config?.mode

  const mode =
    configured ??
    (packet.task?.task_type === 'release'
      ? 'release'
      : 'focused')

  if (!supportedModes.has(mode)) {
    throw new Error(
      `unsupported_verification_mode:${mode}`,
    )
  }

  return mode
}

export function isMilestoneVerification(mode) {
  return mode === 'milestone' || mode === 'release'
}

export function changedPathMatches(changedFiles, prefixes) {
  return prefixes.length === 0 || changedFiles.some(file =>
    prefixes.some(prefix => file.startsWith(prefix)),
  )
}

export function customCheckSelection({
  check,
  changedFiles,
  mode,
  verificationPlanText = '',
}) {
  const prefixes = Array.isArray(check.changed_paths)
    ? check.changed_paths
    : []
  const pathMatched = changedPathMatches(changedFiles, prefixes)
  const required = check.required !== false

  if (
    check.name &&
    verificationPlanText.includes(String(check.name).toLowerCase())
  ) {
    return {
      selected: true,
      reason: 'required_by_task_verification_plan',
    }
  }

  if (pathMatched) {
    return {
      selected: true,
      reason: prefixes.length === 0
        ? 'required_by_workstream_contract'
        : 'changed_path_matched',
    }
  }

  if (required && isMilestoneVerification(mode)) {
    return {
      selected: true,
      reason: 'required_by_milestone_contract',
    }
  }

  return {
    selected: false,
    reason: required
      ? 'outside_focused_changed_scope'
      : 'optional_check_no_changed_path_match',
  }
}

export function applicationScopeSelected({
  appPath,
  changedFiles,
  mode,
  verificationPlanText,
}) {
  if (isMilestoneVerification(mode)) {
    return {
      selected: true,
      reason: 'required_by_milestone_contract',
    }
  }

  if (
    appPath &&
    changedFiles.some(file =>
      file === appPath || file.startsWith(`${appPath}/`),
    )
  ) {
    return {
      selected: true,
      reason: 'changed_file_in_application_scope',
    }
  }

  if (/typecheck|lint|unit test|build/.test(verificationPlanText)) {
    return {
      selected: true,
      reason: 'required_by_task_verification_plan',
    }
  }

  return {
    selected: false,
    reason: 'outside_focused_application_scope',
  }
}

export function controlPlaneRootLintSelection({
  changedFiles,
}) {
  if (
    changedFiles.some(file =>
      file.startsWith('tooling/control-plane/') &&
      /\.(?:c|m)?js$/.test(file),
    )
  ) {
    return {
      selected: true,
      reason: 'changed_control_plane_javascript',
    }
  }

  return {
    selected: false,
    reason: 'no_changed_control_plane_javascript',
  }
}

export function commandResultStatus({
  required,
  exitCode,
  errorCode,
}) {
  if (errorCode === 'ENOENT') {
    return required
      ? 'not_run'
      : 'skipped'
  }

  if (exitCode === 0 && !errorCode) {
    return 'pass'
  }

  return required
    ? 'fail'
    : 'skipped'
}
