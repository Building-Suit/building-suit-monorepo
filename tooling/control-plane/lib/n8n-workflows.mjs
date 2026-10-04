export function normalizeWorkflow(workflow) {
  const nodes = (workflow.nodes ?? []).map(node => ({
    id: node.id ?? null,
    name: node.name ?? 'Unnamed',
    type: node.type ?? 'unknown',
    typeVersion: node.typeVersion ?? null,
    disabled: node.disabled === true,
    parameters: node.parameters ?? {},
  })).sort((a, b) => a.name.localeCompare(b.name))
  const connections = []
  for (const [source, outputs] of Object.entries(workflow.connections ?? {})) {
    for (const [channel, groups] of Object.entries(outputs ?? {})) {
      for (const [outputIndex, targets] of (groups ?? []).entries()) {
        for (const target of targets ?? []) connections.push({
          source, channel, output_index: outputIndex,
          target: target.node, target_type: target.type ?? 'main', target_index: target.index ?? 0,
        })
      }
    }
  }
  return {
    id: workflow.id ?? null,
    name: workflow.name ?? 'Unnamed workflow',
    active: workflow.active === true,
    updatedAt: workflow.updatedAt ?? null,
    nodes,
    connections: connections.sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`)),
    settings: workflow.settings ?? {},
  }
}

export function workflowGraphSummary(workflow) {
  const normalized = normalizeWorkflow(workflow)
  const outgoing = new Map()
  for (const connection of normalized.connections) {
    const targets = outgoing.get(connection.source) ?? []
    targets.push(connection.target)
    outgoing.set(connection.source, targets)
  }
  const lines = [normalized.name]
  for (const node of normalized.nodes) {
    const targets = outgoing.get(node.name) ?? []
    lines.push(`  ${node.name}${targets.length ? ` -> ${targets.join(', ')}` : ''}`)
  }
  return lines.join('\n')
}

export function inspectWorkflowSnapshot(workflows) {
  const findings = []
  for (const workflow of workflows) {
    for (const node of workflow.nodes ?? []) {
      const parameters = JSON.stringify(node.parameters ?? {})
      if (/"fieldName":"(?:suit_slug|project_slug|workstream_slug)"/.test(parameters)
        && /"fieldOptions"/.test(parameters)) {
        findings.push({
          severity: 'warning',
          workflow: workflow.name,
          node: node.name,
          code: 'hardcoded_registry_options',
          recommendation: 'Replace the fixed dropdown with a registry-backed selection step, or accept a slug and validate it through `automation task next/claim`.',
        })
      }
    }
    const nodeNames = new Set((workflow.nodes ?? []).map(node => node.name))
    const serialized = JSON.stringify(workflow.nodes ?? [])
    if (
      [...nodeNames].some(name => /Retry Attempt \d+/i.test(name)) ||
      /task-(?:run|verify|retry|publish)\b/.test(serialized)
    ) {
      findings.push({
        severity: 'warning',
        workflow: workflow.name,
        node: null,
        code: 'n8n_owned_retry_graph',
        recommendation: 'Replace attempt-specific branches with one `automation task engine TASK-ID` call; retry state belongs to the control plane.',
      })
    }
  }
  return {
    compatible: findings.length === 0,
    findings,
    safe_change_process: 'Generate/import a reviewed workflow JSON only after operator confirmation. Never write the n8n database directly.',
  }
}

const replacementIds = Object.freeze({
  'BS-10 — Task Engine': '9aWPOijyhfmnEtRy',
  'BS-20 — Continue Suit': 'pg0BEkbP9E4H4RqB',
  'BS-21 — Stop Suit Run': 'qHGzP3b0PS82IYSw',
})

function workflowText(workflow) {
  return JSON.stringify(workflow)
}

export function validateControllerReplacements(workflows) {
  const errors = []
  const byName = new Map((workflows ?? []).map(workflow => [workflow.name, workflow]))

  for (const [name, id] of Object.entries(replacementIds)) {
    const workflow = byName.get(name)
    if (!workflow) {
      errors.push(`missing_workflow:${name}`)
      continue
    }
    if (workflow.id !== id) errors.push(`workflow_id_mismatch:${name}`)
    if (workflow.active !== false) errors.push(`replacement_must_be_inactive:${name}`)
  }

  const taskEngine = byName.get('BS-10 — Task Engine')
  if (taskEngine) {
    const text = workflowText(taskEngine)
    const supervisorCalls = (taskEngine.nodes ?? []).filter(node =>
      node.type === 'n8n-nodes-base.executeWorkflow' &&
      /task-supervise\b/.test(JSON.stringify(node.parameters ?? {})),
    )
    if (supervisorCalls.length !== 1) errors.push('bs10_requires_one_supervisor_call_node')
    if (/task-(?:run|verify|retry|publish)\b/.test(text)) errors.push('bs10_contains_legacy_lifecycle_command')
    if (/Retry Attempt \d+/i.test(text)) errors.push('bs10_contains_attempt_branch')
    if (/resume_count|retry_count|max_resume/i.test(text)) errors.push('bs10_contains_independent_resume_counter')
    if (!/next_wake_at/.test(text) || !/lease_expires_at/.test(text)) errors.push('bs10_missing_persisted_resume_contract')
    if (!/n8n-nodes-base\.wait/.test(text)) errors.push('bs10_missing_automatic_resume_wait')
  }

  for (const name of ['BS-20 — Continue Suit', 'BS-21 — Stop Suit Run']) {
    const workflow = byName.get(name)
    if (!workflow) continue
    const text = workflowText(workflow)
    if (/"fieldOptions"/.test(text)) errors.push(`hardcoded_registry_options:${name}`)
    if (!/workstream-resolve\b/.test(text)) errors.push(`missing_registry_validation:${name}`)
  }

  const continueWorkflow = byName.get('BS-20 — Continue Suit')
  if (continueWorkflow) {
    const text = workflowText(continueWorkflow)
    if (!text.includes('9aWPOijyhfmnEtRy')) errors.push('bs20_missing_bs10_reference')
    if (!/run-acquire-task\b/.test(text)) errors.push('bs20_missing_run_attributed_acquire')
    if (/bs-agent task-claim\b/.test(text)) errors.push('bs20_contains_anonymous_task_claim')
    if (!/run-complete-task[^"}]*acquisition\.packet\.task\.task_id/.test(text)) errors.push('bs20_missing_task_attributed_completion')
    if (!/BS_BATCH_CONTROLLER_FINGERPRINT/.test(text)) errors.push('bs20_missing_trusted_controller_fingerprint_transport')
    if (/run-finish[^"}]* finished/.test(text)) errors.push('bs20_finishes_run_when_no_task_is_admitted')
    for (const state of ['success', 'wait', 'safety-stop', 'no-ready-task', 'maintenance-wait', 'stop-requested', 'task-limit']) {
      if (!text.includes(state)) errors.push(`bs20_missing_state:${state}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    replacement_ids: replacementIds,
  }
}
