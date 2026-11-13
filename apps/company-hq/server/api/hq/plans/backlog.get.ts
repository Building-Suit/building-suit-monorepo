import { createHash } from 'node:crypto'
import { createError } from 'h3'
import type { HqBacklogPlan } from '@building-suit/ui/types/hqLayoutPresentation'
import { readBrainNote } from '../../../utils/brain'
import { requireHqFounder } from '../../../utils/hqAccess'

const INDEX_FILE = '1zIJdIDGCOa9avfa6BS29ZSFxgh6ygQx9'
const INDEX_PATH = 'Work Outputs/Work Outputs.md'
const INDEX_ID = createHash('sha256').update(INDEX_FILE).digest('base64url')

function parseBacklog(content: string): HqBacklogPlan[] {
  const section = content.split(/^## Company Plans backlog[ \t]*\r?$/m)
  if (section.length !== 2) throw new Error('Expected one Company Plans backlog')
  const rows = section[1]!.split(/^## /m)[0]!.split(/\r?\n/).filter(line => line.startsWith('|'))
  if (rows.shift()?.trim() !== '| ID | Status | Plan | Next step | Source |'
    || rows.shift()?.trim() !== '| --- | --- | --- | --- | --- |'
    || rows.length > 100) throw new Error('Invalid Company Plans backlog table')

  const seen = new Set<string>()
  return rows.map(row => {
    const [start, id, status, title, summary, source, end, ...rest] = row.trim().split('|').map(cell => cell.trim())
    if (start !== '' || end !== '' || rest.length || !id || !/^[a-z0-9-]{1,80}$/.test(id) || seen.has(id)
      || (status !== 'pending' && status !== 'ongoing' && status !== 'done')
      || !title || title.length > 200 || !summary || summary.length > 600
      || source === undefined || (source && !/^[A-Za-z0-9_-]{10,100}$/.test(source))) throw new Error('Invalid Company Plans backlog row')
    seen.add(id)
    return { id, status, title, summary, ...(source ? { sourceUrl: `https://drive.google.com/file/d/${source}/view` } : {}) }
  })
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  await requireHqFounder(event, config)
  try {
    const note = await readBrainNote(config, INDEX_ID, INDEX_PATH)
    return parseBacklog(note.content)
  }
  catch {
    throw createError({ statusCode: 503, statusMessage: 'Brain plans unavailable' })
  }
})
