import { createHash, timingSafeEqual } from 'node:crypto'
import { createError, getHeader, setResponseHeaders, type H3Event } from 'h3'
import type { BrainIndex, BrainNote, BrainNoteSummary } from '../../shared/types/brain'
import { BrainCloudError, BrainCloudLimit, createDriveReader, MAX_NOTE_BYTES, type DriveReader, type GoogleBrainConfig } from './googleDriveAuth'

const ROOT_FOLDER_ID = '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
const ROOT_FOLDER_NAME = 'building-suit-brain'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const NOTE_MIMES = new Set(['text/markdown', 'text/x-markdown', 'text/plain'])
const MAX_NOTES = 2_000
const MAX_DEPTH = 20
const MAX_ENTRIES = 20_000
const LOOPBACK_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const HOST_PATTERN = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::([0-9]{1,5}))?$/i
const DEV_PROXY_HEADER = 'x-hq-brain-dev-proxy'
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/
const PRIVATE_NAME = /(?:^|[\s._-])(?:secrets?|credentials?|passwords?|tokens?|private|(?:api|access|service)[\s._-]*keys?|answer[\s._-]*keys?|test[\s._-]*keys?)(?:$|[\s._-])/iu
const SCRIPT_DIRECTORY = /(?:^|[\s._-])scripts?(?:$|[\s._-])/iu
const EXCLUDED_DIRECTORIES = new Set(['scripts', 'script', 'node_modules', 'vendor'])
const FILE_FIELDS = 'id,name,mimeType,parents,trashed,modifiedTime,size,version,md5Checksum,sha256Checksum,capabilities(canDownload)'

interface DriveFile {
  id: string
  name: string
  mimeType: string
  parents: string[]
  trashed: boolean
  modifiedTime?: string
  size?: string
  version?: string
  md5Checksum?: string
  sha256Checksum?: string
  canDownload: boolean
}

interface VerifiedFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  depth: number
}

interface IndexedNote {
  fileId: string
  parentId: string
  summary: BrainNoteSummary
}

interface ScanResult {
  index: BrainIndex
  reader: DriveReader | null
  folders: Map<string, VerifiedFolder>
  files: IndexedNote[]
}

/** This local preview has no remote identity boundary: Brain routes stay loopback-only. */
export function assertLocalBrainRequest(event: H3Event, config: { hqBrainDevProxyToken?: unknown }): void {
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    'Pragma': 'no-cache',
    'Vary': 'Origin, X-HQ-Brain',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  })

  const peer = event.node.req.socket?.remoteAddress
  const proxyToken = getHeader(event, DEV_PROXY_HEADER)
  const expectedToken = config.hqBrainDevProxyToken
  const trustedDevProxy = import.meta.dev && peer === undefined
    && typeof expectedToken === 'string' && /^[a-f0-9]{64}$/.test(expectedToken)
    && typeof proxyToken === 'string' && /^[a-f0-9]{64}$/.test(proxyToken)
    && timingSafeEqual(Buffer.from(proxyToken, 'hex'), Buffer.from(expectedToken, 'hex'))
  const host = getHeader(event, 'host') ?? ''
  const match = HOST_PATTERN.exec(host)
  const port = match?.[1] ? Number(match[1]) : null
  const fetchSite = getHeader(event, 'sec-fetch-site')

  if (!(peer !== undefined && LOOPBACK_PEERS.has(peer) || trustedDevProxy) || !match || (port !== null && (port < 1 || port > 65_535))
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

function unavailableIndex(reason: NonNullable<BrainIndex['reason']>): BrainIndex {
  return { status: 'unavailable', source: 'google-drive', reason, observedAt: new Date().toISOString(), notes: [], count: 0, partial: false }
}

function eligibleName(name: string, directory: boolean): boolean {
  if (!name || name.startsWith('.') || name.includes('/') || name.includes('\\') || PRIVATE_NAME.test(name)) return false
  if (directory) return !SCRIPT_DIRECTORY.test(name) && !EXCLUDED_DIRECTORIES.has(name.toLowerCase())
  return /\.md$/i.test(name)
}

function asDriveFile(value: unknown): DriveFile | null {
  if (!value || typeof value !== 'object') return null
  const file = value as Record<string, unknown>
  if (typeof file.id !== 'string' || !FILE_ID_PATTERN.test(file.id) || typeof file.name !== 'string'
    || typeof file.mimeType !== 'string' || file.trashed !== false) return null
  const parents = Array.isArray(file.parents) ? file.parents.filter((id): id is string => typeof id === 'string' && FILE_ID_PATTERN.test(id)) : []
  const capabilities = file.capabilities && typeof file.capabilities === 'object' ? file.capabilities as Record<string, unknown> : {}
  return {
    id: file.id, name: file.name, mimeType: file.mimeType, trashed: false, parents,
    modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : undefined,
    size: typeof file.size === 'string' ? file.size : undefined,
    version: typeof file.version === 'string' ? file.version : undefined,
    md5Checksum: typeof file.md5Checksum === 'string' ? file.md5Checksum : undefined,
    sha256Checksum: typeof file.sha256Checksum === 'string' ? file.sha256Checksum : undefined,
    canDownload: capabilities.canDownload === true,
  }
}

async function metadata(reader: DriveReader, id: string): Promise<DriveFile> {
  const file = asDriveFile(await reader.json(id, { fields: FILE_FIELDS }))
  if (!file || file.id !== id) throw new BrainCloudError()
  return file
}

function validRoot(file: DriveFile): boolean {
  return file.id === ROOT_FOLDER_ID && file.name === ROOT_FOLDER_NAME && file.mimeType === FOLDER_MIME && !file.trashed
}

/** Follow only folder IDs already established through the authorized root. */
async function verifyFolderChain(
  reader: DriveReader,
  folder: VerifiedFolder,
  folders: Map<string, VerifiedFolder>,
  observe: (id: string) => Promise<DriveFile> = id => metadata(reader, id),
): Promise<boolean> {
  let current: VerifiedFolder | undefined = folder
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current.id) || visited.size > MAX_DEPTH) return false
    visited.add(current.id)
    const file = await observe(current.id)
    if (current.id === ROOT_FOLDER_ID) return validRoot(file)
    if (file.mimeType !== FOLDER_MIME || file.name !== current.name || !eligibleName(file.name, true)
      || file.parents.length !== 1 || file.parents[0] !== current.parentId) return false
    // An unknown/moved parent is rejected before any request to that parent.
    current = current.parentId ? folders.get(current.parentId) : undefined
  }
  return false
}

function noteSummary(file: DriveFile, folder: VerifiedFolder): BrainNoteSummary | null {
  if (!NOTE_MIMES.has(file.mimeType) || !eligibleName(file.name, false) || !file.canDownload
    || !file.modifiedTime || !Number.isFinite(Date.parse(file.modifiedTime)) || !file.version || !/^\d+$/.test(file.version)
    || !file.size || !/^\d+$/.test(file.size) || Number(file.size) > MAX_NOTE_BYTES) return null
  const checksum = file.sha256Checksum ?? file.md5Checksum
  return {
    id: createHash('sha256').update(file.id).digest('base64url'),
    title: file.name.replace(/\.md$/i, ''),
    path: folder.path ? `${folder.path}/${file.name}` : file.name,
    modifiedAt: file.modifiedTime,
    version: checksum ? `${file.version}:${checksum}` : file.version,
  }
}

async function scanBrain(config: GoogleBrainConfig, requestedId?: string): Promise<ScanResult> {
  const folders = new Map<string, VerifiedFolder>()
  const files: IndexedNote[] = []
  let reader: DriveReader | null = null
  const unavailable = (reason: NonNullable<BrainIndex['reason']>): ScanResult => ({ index: unavailableIndex(reason), reader: null, folders: new Map(), files: [] })
  try {
    reader = await createDriveReader(config)
    if (!reader) return unavailable('not-configured')
    const activeReader = reader
    // Share repeated ancestor observations only within this index scan. Note
    // downloads keep fresh, uncached ancestry checks before and after reading.
    const observations = new Map<string, Promise<DriveFile>>()
    const observe = (id: string): Promise<DriveFile> => {
      const existing = observations.get(id)
      if (existing) return existing
      const pending = metadata(activeReader, id)
      observations.set(id, pending)
      return pending
    }
    const root = await observe(ROOT_FOLDER_ID)
    if (!validRoot(root)) return unavailable('authorization-required')
    const rootFolder: VerifiedFolder = { id: ROOT_FOLDER_ID, name: ROOT_FOLDER_NAME, parentId: null, path: '', depth: 0 }
    folders.set(ROOT_FOLDER_ID, rootFolder)
    const queue: VerifiedFolder[] = [rootFolder]
    const indexedIds = new Set<string>()
    let inspected = 0
    let partial = false
    let stopped = false

    async function visitFolder(folder: VerifiedFolder): Promise<void> {
      if (stopped) return
      if (!await verifyFolderChain(activeReader, folder, folders, observe)) { partial = true; return }
      let pageToken: string | undefined
      const seenPages = new Set<string>()
      do {
        if (stopped) return
        const data = await activeReader.json(null, {
          q: `'${folder.id}' in parents and trashed = false`,
          fields: `nextPageToken,incompleteSearch,files(${FILE_FIELDS})`,
          spaces: 'drive', pageSize: '100', orderBy: 'name', includeItemsFromAllDrives: 'true',
          ...(pageToken ? { pageToken } : {}),
        })
        if (stopped) return
        if (!data || typeof data !== 'object') throw new BrainCloudError()
        const page = data as Record<string, unknown>
        if (!Array.isArray(page.files)) throw new BrainCloudError()
        if (page.incompleteSearch === true) partial = true
        for (const value of page.files) {
          inspected += 1
          if (inspected > MAX_ENTRIES) { partial = true; stopped = true; break }
          const file = asDriveFile(value)
          if (!file || file.parents.length !== 1 || file.parents[0] !== folder.id) continue
          if (file.mimeType === FOLDER_MIME) {
            if (!eligibleName(file.name, true) || folders.has(file.id)) continue
            if (folder.depth >= MAX_DEPTH) { partial = true; continue }
            const child: VerifiedFolder = {
              id: file.id, name: file.name, parentId: folder.id, depth: folder.depth + 1,
              path: folder.path ? `${folder.path}/${file.name}` : file.name,
            }
            folders.set(child.id, child)
            queue.push(child)
            continue
          }
          // Shortcuts and native/binary Drive objects never enter the note index.
          if (!NOTE_MIMES.has(file.mimeType) || !eligibleName(file.name, false)) continue
          const summary = noteSummary(file, folder)
          if (!summary) { partial = true; continue }
          if (indexedIds.has(file.id)) continue
          if (files.length >= MAX_NOTES) { partial = true; stopped = true; break }
          files.push({ fileId: file.id, parentId: folder.id, summary })
          indexedIds.add(file.id)
          // A selected-note request needs only its established descendant path,
          // leaving time and HTTP budget for fresh content authorization checks.
          if (summary.id === requestedId) { partial = true; stopped = true; break }
        }
        pageToken = typeof page.nextPageToken === 'string' && page.nextPageToken ? page.nextPageToken : undefined
        if (pageToken) {
          if (seenPages.has(pageToken)) { partial = true; stopped = true; break }
          seenPages.add(pageToken)
        }
      } while (pageToken && !stopped)
    }

    while (queue.length && !stopped) {
      const wave = queue.splice(0, 4)
      const results = await Promise.allSettled(wave.map(async folder => {
        try {
          await visitFolder(folder)
        }
        catch (error) {
          stopped = true
          throw error
        }
      }))
      let failure: unknown
      // Await and inspect every in-flight folder before returning or scheduling
      // another wave; at most four folder operations can run concurrently.
      for (const result of results) {
        if (result.status !== 'rejected') continue
        if (result.reason instanceof BrainCloudLimit) partial = true
        else if (failure === undefined) failure = result.reason
      }
      if (failure !== undefined) throw failure
    }

    files.sort((a, b) => a.summary.path.localeCompare(b.summary.path, 'en'))
    return {
      reader, folders, files,
      index: {
        status: 'connected', source: 'google-drive', observedAt: new Date().toISOString(),
        notes: files.map(file => file.summary), count: files.length, partial,
      },
    }
  }
  catch (error) {
    return unavailable(error instanceof BrainCloudError ? error.reason : 'cloud-unavailable')
  }
}

export async function readBrainIndex(config: GoogleBrainConfig): Promise<BrainIndex> {
  return (await scanBrain(config)).index
}

async function currentNote(reader: DriveReader, note: IndexedNote, folders: Map<string, VerifiedFolder>): Promise<BrainNoteSummary | null> {
  const file = await metadata(reader, note.fileId)
  const parent = folders.get(note.parentId)
  if (!parent || file.parents.length !== 1 || file.parents[0] !== parent.id || !await verifyFolderChain(reader, parent, folders)) return null
  return noteSummary(file, parent)
}

export async function readBrainNote(config: GoogleBrainConfig, id: string | undefined): Promise<BrainNote> {
  const notFound = () => createError({ statusCode: 404, statusMessage: 'Brain note unavailable' })
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) throw notFound()
  const scan = await scanBrain(config, id)
  const note = scan.files.find(file => file.summary.id === id)
  if (!scan.reader || !note) throw notFound()
  try {
    const before = await currentNote(scan.reader, note, scan.folders)
    if (!before) throw notFound()
    const content = await scan.reader.markdown(note.fileId)
    // Discard content if its cloud version or approved parent chain changed
    // during download; the next refresh can discover the new current version.
    const after = await currentNote(scan.reader, note, scan.folders)
    if (!after || after.version !== before.version || after.path !== before.path) throw notFound()
    return { ...after, content }
  }
  catch {
    throw notFound()
  }
}
