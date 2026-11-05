import { createError } from 'h3'
import { requireHqFounder } from '../../../utils/hqAccess'
import { readBrainIndex, readBrainNote } from '../../../utils/brain'
import { parseMeetingRegistry } from '../../../../shared/meetings/registry.mjs'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  await requireHqFounder(event, config)
  const index = await readBrainIndex(config)
  const source = index.notes.filter(note => note.path === 'Company/Agent Registry.md')
  if (index.status !== 'connected' || source.length !== 1) throw createError({ statusCode: 503, statusMessage: 'Canonical roster unavailable' })
  const note = await readBrainNote(config, source[0]!.id)
  try { return { participants: parseMeetingRegistry(note.content, { id: note.id, version: note.version }), observedAt: index.observedAt } }
  catch { throw createError({ statusCode: 503, statusMessage: 'Canonical roster unavailable' }) }
})
