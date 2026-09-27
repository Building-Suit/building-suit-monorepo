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
    if ([...nodeNames].some(name => /Retry Attempt \d+/i.test(name))) {
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
