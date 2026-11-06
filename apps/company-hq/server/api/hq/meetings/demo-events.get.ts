import { watch } from 'node:fs'
import { basename, dirname } from 'node:path'
import { createError, setResponseHeaders } from 'h3'
import { demoSnapshot } from '../../../meetings/demoService.mjs'
import { requireMeetingDemo } from '../../../utils/meetingRequest'

let connections = 0
/** Fixture changes are file notifications, never recurring application fetches. */
export default defineEventHandler(async event => {
  const { filename, owner } = requireMeetingDemo(event, useRuntimeConfig(event))
  if (connections >= 8) throw createError({ statusCode: 429, statusMessage: 'Meeting connection limit' })
  const initial = demoSnapshot(filename, owner).record
  let revision = initial?.revision ?? 0
  let signature = `${initial?.id ?? ''}:${revision}`
  const response = event.node.res
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store', 'X-Accel-Buffering': 'no' })
  response.flushHeaders()
  connections++
  await new Promise<void>(resolve => {
    let closed = false
    let dirtyTimer: ReturnType<typeof setTimeout> | undefined
    const send = (name: string, data: object) => {
      if (!closed && !response.destroyed && !response.writableEnded && response.writableLength < 16384) response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
      else close()
    }
    const notify = () => {
      dirtyTimer = undefined
      try {
        const next = demoSnapshot(filename, owner).record
        const nextSignature = `${next?.id ?? ''}:${next?.revision ?? 0}`
        if (nextSignature !== signature) { signature = nextSignature; revision = next?.revision ?? 0; send('meeting', { revision, meetingId: next?.id }) }
      }
      catch { close() }
    }
    const watcher = watch(dirname(filename), (_type, file) => {
      if (file && String(file).startsWith(basename(filename)) && !dirtyTimer) dirtyTimer = setTimeout(notify, 80)
    })
    const heartbeat = setInterval(() => { if (!closed && response.writableLength < 16384) response.write(': heartbeat\n\n'); else close() }, 20000)
    const expiry = setTimeout(() => close(), 300000)
    function close() {
      if (closed) return
      closed = true; clearTimeout(dirtyTimer); clearTimeout(expiry); clearInterval(heartbeat); watcher.close(); connections--
      response.removeListener('close', close); response.removeListener('error', close); event.node.req.removeListener('aborted', close)
      if (!response.destroyed && !response.writableEnded) response.end()
      resolve()
    }
    watcher.on('error', close)
    response.once('close', close); response.once('error', close); event.node.req.once('aborted', close)
    send('ready', { revision })
  })
})
