import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, open, opendir, realpath } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { createError, getHeader, setResponseHeaders, type H3Event } from 'h3'
import type { BrainIndex, BrainNote, BrainNoteSummary } from '../../shared/types/brain'

const MAX_NOTES = 2_000
const MAX_DEPTH = 20
const MAX_ENTRIES = 20_000
const MAX_NOTE_BYTES = 512 * 1024
const LOOPBACK_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const HOST_PATTERN = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::([0-9]{1,5}))?$/i
const PRIVATE_NAME = /(?:^|[\s._-])(?:secrets?|credentials?|passwords?|tokens?|private|(?:api|access|service)[\s._-]*keys?|answer[\s._-]*keys?|test[\s._-]*keys?)(?:$|[\s._-])/iu
const SCRIPT_DIRECTORY = /(?:^|[\s._-])scripts?(?:$|[\s._-])/iu
const EXCLUDED_DIRECTORIES = new Set(['scripts', 'script', 'node_modules', 'vendor'])

interface IndexedNote {
  summary: BrainNoteSummary
  filename: string
  device: number
  inode: number
}

interface ScanResult {
  index: BrainIndex
  root: string | null
  files: IndexedNote[]
}

/** This local preview has no remote identity boundary: Brain routes stay loopback-only. */
export function assertLocalBrainRequest(event: H3Event): void {
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    'Pragma': 'no-cache',
    'Vary': 'Origin, X-HQ-Brain',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  })

  const peer = event.node.req.socket?.remoteAddress
  const host = getHeader(event, 'host') ?? ''
  const match = HOST_PATTERN.exec(host)
  const port = match?.[1] ? Number(match[1]) : null
  const fetchSite = getHeader(event, 'sec-fetch-site')

  if (!peer || !LOOPBACK_PEERS.has(peer) || !match || (port !== null && (port < 1 || port > 65_535))
    || getHeader(event, 'x-hq-brain') !== '1'
    || (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
    throw createError({ statusCode: 403, statusMessage: 'Brain access unavailable' })
  }

  // Never trust forwarded host/IP headers as authority. The browser's optional
  // origin and referrer must match the actual loopback Host header.
  const secure = Boolean((event.node.req.socket as { encrypted?: boolean }).encrypted)
  const expectedOrigin = new URL(`${secure ? 'https' : 'http'}://${host}`).origin
  for (const name of ['origin', 'referer']) {
    const value = getHeader(event, name)
    if (!value) continue
    try {
      if (new URL(value).origin !== expectedOrigin) throw new Error('Origin rejected')
    }
    catch {
      throw createError({ statusCode: 403, statusMessage: 'Brain access unavailable' })
    }
  }
}

function unavailableIndex(): BrainIndex {
  return { status: 'unavailable', source: 'local-mirror', observedAt: new Date().toISOString(), notes: [], count: 0, partial: false }
}

function eligibleName(name: string, directory: boolean): boolean {
  if (name.startsWith('.') || PRIVATE_NAME.test(name)) return false
  if (directory) return !SCRIPT_DIRECTORY.test(name) && !EXCLUDED_DIRECTORIES.has(name.toLowerCase())
  return /\.md$/i.test(name)
}

function withinRoot(root: string, filename: string): boolean {
  const child = relative(root, filename)
  return child !== '' && !child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child)
}

async function scanBrain(configuredPath: unknown): Promise<ScanResult> {
  const unavailable: ScanResult = { index: unavailableIndex(), root: null, files: [] }
  if (typeof configuredPath !== 'string' || !isAbsolute(configuredPath) || basename(configuredPath) !== 'building-suit-brain') return unavailable

  let root: string
  try {
    const info = await lstat(configuredPath)
    if (!info.isDirectory() || info.isSymbolicLink()) return unavailable
    root = await realpath(configuredPath)
    // Open the root before reporting an established local-folder connection.
    const directory = await opendir(root)
    await directory.close()
  }
  catch {
    return unavailable
  }

  const files: IndexedNote[] = []
  let partial = false
  let inspected = 0
  let stopped = false

  async function visit(directoryPath: string, depth: number): Promise<void> {
    if (stopped) return
    if (depth > MAX_DEPTH) { partial = true; return }
    try {
      const directory = await opendir(directoryPath)
      for await (const entry of directory) {
        if (stopped) break
        inspected += 1
        if (inspected > MAX_ENTRIES) { partial = true; stopped = true; break }
        if (entry.isSymbolicLink() || !eligibleName(entry.name, entry.isDirectory())) continue
        const filename = join(directoryPath, entry.name)
        const info = await lstat(filename)
        if (info.isSymbolicLink()) continue
        const resolved = await realpath(filename)
        if (!withinRoot(root, resolved)) continue
        if (info.isDirectory()) {
          await visit(resolved, depth + 1)
          continue
        }
        if (!info.isFile() || info.size > MAX_NOTE_BYTES) {
          if (info.isFile()) partial = true
          continue
        }
        if (files.length >= MAX_NOTES) { partial = true; stopped = true; break }
        const path = relative(root, resolved).split(sep).join('/')
        files.push({
          summary: {
            id: createHash('sha256').update(path).digest('base64url'),
            title: entry.name.replace(/\.md$/i, ''),
            path,
            modifiedAt: info.mtime.toISOString(),
          },
          filename: resolved,
          device: info.dev,
          inode: info.ino,
        })
      }
    }
    catch {
      // Files may change while the desktop sync client updates the mirror.
      // Omit unavailable entries without exposing host paths or error details.
      partial = true
    }
  }

  await visit(root, 0)
  files.sort((a, b) => a.summary.path.localeCompare(b.summary.path, 'en'))
  return {
    root,
    files,
    index: {
      status: 'connected', source: 'local-mirror', observedAt: new Date().toISOString(),
      notes: files.map(file => file.summary), count: files.length, partial,
    },
  }
}

export async function readBrainIndex(configuredPath: unknown): Promise<BrainIndex> {
  return (await scanBrain(configuredPath)).index
}

export async function readBrainNote(configuredPath: unknown, id: string | undefined): Promise<BrainNote> {
  const notFound = () => createError({ statusCode: 404, statusMessage: 'Brain note unavailable' })
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) throw notFound()
  const scan = await scanBrain(configuredPath)
  const note = scan.files.find(file => file.summary.id === id)
  if (!scan.root || !note) throw notFound()

  try {
    // Recheck the resolved path and inode before reading. O_NOFOLLOW prevents
    // a synchronized file from becoming a symlink between listing and open.
    const resolved = await realpath(note.filename)
    if (!withinRoot(scan.root, resolved) || resolved !== note.filename) throw notFound()
    const handle = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const info = await handle.stat()
      if (!info.isFile() || info.size > MAX_NOTE_BYTES || info.dev !== note.device || info.ino !== note.inode) throw notFound()
      const buffer = Buffer.alloc(MAX_NOTE_BYTES + 1)
      let totalRead = 0
      while (totalRead < buffer.length) {
        const { bytesRead } = await handle.read(buffer, totalRead, buffer.length - totalRead, totalRead)
        if (bytesRead === 0) break
        totalRead += bytesRead
      }
      if (totalRead > MAX_NOTE_BYTES) throw notFound()
      const content = buffer.subarray(0, totalRead).toString('utf8')
      if (content.includes('\0')) throw notFound()
      return { ...note.summary, modifiedAt: info.mtime.toISOString(), content }
    }
    finally {
      await handle.close()
    }
  }
  catch {
    throw notFound()
  }
}
