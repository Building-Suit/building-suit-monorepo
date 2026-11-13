import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function planValidation(eventName, event = {}) {
  if (eventName !== 'push' && eventName !== 'pull_request') throw new Error('Unsupported validation event')
  const metadata = eventName === 'pull_request' && event.action === 'edited' &&
    event.changes?.base == null && (event.changes?.title != null || event.changes?.body != null)
  const validate = !metadata
  const full = validate && (eventName === 'push' || ['stg', 'main'].includes(event.pull_request?.base?.ref))
  return { validate, full }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = planValidation(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')))
  appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''))
}
