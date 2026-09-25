import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export default defineEventHandler(() => {
  const file = path.resolve(process.cwd(), '.local/automation/n8n/workflows.normalized.json')
  if (!existsSync(file)) return { available: false, workflows: [], message: 'Run pnpm automation:n8n:export on the control-plane host.' }
  const snapshot = JSON.parse(readFileSync(file, 'utf8'))
  return { available: true, ...snapshot }
})
