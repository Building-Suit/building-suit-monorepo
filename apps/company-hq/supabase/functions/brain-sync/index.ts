// Hosted staging bridge only. Notifications are wake-up hints; all operational
// data is re-read from the fixed private Drive root before a cursor is committed.
// Drive text never becomes an instruction, founder decision or hiring execution.
import type { Database } from '../_shared/database.types.ts'
const STAGING_URL = 'https://dpruoncalmwicrqhqelu.supabase.co'
const ROOT_ID = '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
const ROOT_NAME = 'building-suit-brain'
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const NOTE_MIMES = new Set(['text/plain', 'text/markdown', 'text/x-markdown'])
const JSON_MIMES = new Set(['application/json', 'text/plain'])
const FILE_ID = /^[A-Za-z0-9_-]{10,200}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SOURCE_VERSION = /^[0-9]{1,40}$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/
const PRIVATE_NAME = /(?:^|[\s._-])(?:secrets?|credentials?|passwords?|tokens?|private|(?:api|access|service)[\s._-]*keys?|answer[\s._-]*keys?|test[\s._-]*keys?)(?:$|[\s._-])/iu
const SCRIPT_NAME = /(?:^|[\s._-])scripts?(?:$|[\s._-])/iu
const FILE_FIELDS = 'id,name,mimeType,parents,version,modifiedTime,trashed,size,capabilities(canDownload)'
const MAX_FILES = 5_000
const MAX_ENTRIES = 20_000
const MAX_DEPTH = 20
const MAX_METADATA_BYTES = 4 * 1_024 * 1_024
const MAX_MANIFEST_BYTES = 512 * 1_024
const RUN_MS = 120_000 // Below the database's three-minute lease.
const MAX_REQUESTS = 240
const WATCH_MS = 6 * 24 * 60 * 60 * 1_000
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1_000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })

type FailureReason = 'cloud-unavailable' | 'invalid-source' | 'source-conflict' | 'cursor-expired'
  | 'publisher-unavailable' | 'configuration-required' | 'lease-lost'
type RpcName = Extract<keyof Database['public']['Functions'], 'hq_brain_authorize_worker' | 'hq_brain_sync_claim' | 'hq_brain_sync_commit'
  | 'hq_brain_sync_fail' | 'hq_brain_channel_prepare' | 'hq_brain_channel_confirm'
  | 'hq_brain_notify' | 'hq_brain_publish_plan'>

class SyncFailure extends Error {
  constructor(readonly reason: FailureReason, readonly status = 503) { super(reason) }
}

interface Config {
  url: string
  serviceKey: string
  email: string
  privateKey: string
  manifestId: string | null
}
interface IndexedFile {
  fileId: string
  name: string
  mimeType: string
  parents: string[]
  version: string
  modifiedTime: string | null
  trashed: boolean
  inScope: boolean
}
interface DriveFile extends IndexedFile { size: number | null; canDownload: boolean }
interface Folder { file: DriveFile; parentId: string | null; depth: number }
interface Snapshot { files: IndexedFile[]; byId: Map<string, DriveFile>; folders: Map<string, Folder> }
interface Channel { id: string; resourceId: string; expiresAt: string }
interface Claim {
  claimed: boolean
  rootId: string
  cursor: string | null
  generation: number
  fullReconcile: boolean
  leaseExpiresAt: string | null
  channel: Channel | null
}
type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyncFailure('invalid-source')
  return value as JsonObject
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\u0000')) {
    throw new SyncFailure('invalid-source')
  }
  return value
}

function exactShape(value: unknown, required: string[], optional: string[] = []): JsonObject {
  const row = object(value)
  const allowed = new Set([...required, ...optional])
  if (required.some(key => !Object.hasOwn(row, key)) || Object.keys(row).some(key => !allowed.has(key))) {
    throw new SyncFailure('invalid-source')
  }
  return row
}

function config(): Config {
  const url = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const email = Deno.env.get('HQ_BRAIN_GOOGLE_CLIENT_EMAIL') ?? ''
  const privateKey = (Deno.env.get('HQ_BRAIN_GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
  const manifestId = Deno.env.get('HQ_BRAIN_PLAN_FILE_ID') || null
  if (url !== STAGING_URL || !serviceKey || serviceKey.length > 16_384
    || (manifestId !== null && !FILE_ID.test(manifestId))) throw new SyncFailure('configuration-required')
  return { url, serviceKey, email, privateKey, manifestId }
}

class Budget {
  readonly deadline = Date.now() + RUN_MS
  private requests = 0
  signal(maxMs = 10_000): AbortSignal {
    const remaining = this.deadline - Date.now()
    if (remaining < 250 || ++this.requests > MAX_REQUESTS) throw new SyncFailure('cloud-unavailable')
    return AbortSignal.timeout(Math.min(maxMs, remaining))
  }
  checkpoint(): void {
    if (Date.now() >= this.deadline - 2_000) throw new SyncFailure('cloud-unavailable')
  }
}

async function readBytes(response: Response, max: number, timeoutMs?: number): Promise<Uint8Array> {
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) {
    await response.body?.cancel()
    throw new SyncFailure('invalid-source')
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  if (timeoutMs !== undefined) timer = setTimeout(() => {
    timedOut = true
    void reader.cancel().catch(() => undefined)
  }, timeoutMs)
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      total += chunk.value.byteLength
      if (total > max) throw new SyncFailure('invalid-source')
      chunks.push(chunk.value)
    }
    if (timedOut) throw new SyncFailure('invalid-source')
  }
  catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  }
  finally { if (timer !== undefined) clearTimeout(timer); reader.releaseLock() }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

async function readJson(response: Response, max = 1_048_576): Promise<unknown> {
  try { return JSON.parse(decoder.decode(await readBytes(response, max))) }
  catch (error) { throw error instanceof SyncFailure ? error : new SyncFailure('invalid-source') }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function rpc<T>(cfg: Config, budget: Budget, name: RpcName, body: JsonObject): Promise<T> {
  // Only compile-time allowlisted RPC names enter this fixed project endpoint.
  let response: Response
  try {
    response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
      method: 'POST', redirect: 'error', credentials: 'omit', signal: budget.signal(),
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  catch { throw new SyncFailure('cloud-unavailable') }
  if (!response.ok) {
    // A bounded, internal code distinguishes setup from a retryable publication
    // conflict. Neither database messages nor upstream bodies reach logs/clients.
    const error = await readJson(response, 16_384).catch(() => null)
    const message = error && typeof error === 'object' ? (error as JsonObject).message : null
    if (message === 'HQ_SOURCE_NOT_BOUND') throw new SyncFailure('configuration-required')
    if (message === 'HQ_SYNC_LEASE_LOST') throw new SyncFailure('lease-lost')
    if (name === 'hq_brain_publish_plan') throw new SyncFailure('publisher-unavailable')
    throw new SyncFailure('cloud-unavailable')
  }
  return await readJson(response, MAX_METADATA_BYTES) as T
}

async function googleToken(cfg: Config, budget: Budget): Promise<string> {
  if (!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(cfg.email)
    || cfg.privateKey.length > 32_768 || !cfg.privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new SyncFailure('configuration-required')
  }
  try {
    const pem = cfg.privateKey.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\s/g, '')
    const der = Uint8Array.from(atob(pem), character => character.charCodeAt(0))
    const key = await crypto.subtle.importKey('pkcs8', der,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    if ((key.algorithm as RsaKeyAlgorithm).modulusLength < 2_048) throw new SyncFailure('configuration-required')
    const now = Math.floor(Date.now() / 1_000)
    const header = base64Url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
    const claims = base64Url(encoder.encode(JSON.stringify({
      iss: cfg.email, scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: TOKEN_URL, iat: now - 30, exp: now + 300,
    })))
    const unsigned = `${header}.${claims}`
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned))
    const response = await fetch(TOKEN_URL, {
      method: 'POST', redirect: 'error', credentials: 'omit', signal: budget.signal(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}` }),
    })
    if (!response.ok) { await response.body?.cancel(); throw new SyncFailure('configuration-required') }
    const token = object(await readJson(response, 16_384))
    if (token.token_type !== 'Bearer' || typeof token.access_token !== 'string'
      || token.access_token.length < 20 || token.access_token.length > 8_192
      || typeof token.expires_in !== 'number' || token.expires_in < 120) throw new SyncFailure('configuration-required')
    return token.access_token
  }
  catch (error) { throw error instanceof SyncFailure ? error : new SyncFailure('configuration-required') }
}

class Drive {
  constructor(private token: string, private budget: Budget) {}
  private async request(path: string, params: Record<string, string>, body?: JsonObject): Promise<Response> {
    const url = new URL(`${DRIVE_BASE}/${path}`)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    let response: Response
    try {
      response = await fetch(url, {
        method: body ? 'POST' : 'GET', redirect: 'error', credentials: 'omit', signal: this.budget.signal(),
        headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    }
    catch { throw new SyncFailure('cloud-unavailable') }
    if (!response.ok) {
      await response.body?.cancel()
      if (response.status === 410 && path === 'changes') throw new SyncFailure('cursor-expired')
      if (response.status === 401 || response.status === 404) throw new SyncFailure('invalid-source')
      throw new SyncFailure('cloud-unavailable')
    }
    return response
  }
  async metadata(id: string): Promise<DriveFile> {
    if (!FILE_ID.test(id)) throw new SyncFailure('invalid-source')
    const row = parseFile(await readJson(await this.request(`files/${id}`, { fields: FILE_FIELDS, supportsAllDrives: 'true' })))
    if (row.fileId !== id) throw new SyncFailure('invalid-source')
    return row
  }
  async children(id: string, pageToken?: string): Promise<{ files: unknown[]; next: string | null }> {
    if (!FILE_ID.test(id)) throw new SyncFailure('invalid-source')
    const row = object(await readJson(await this.request('files', {
      q: `'${id}' in parents and trashed = false`, pageSize: '1000', spaces: 'drive',
      fields: `nextPageToken,incompleteSearch,files(${FILE_FIELDS})`,
      supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...(pageToken ? { pageToken } : {}),
    })))
    if (row.incompleteSearch === true || !Array.isArray(row.files) || row.files.length > 1_000) throw new SyncFailure('invalid-source')
    return { files: row.files, next: cursor(row.nextPageToken, true) }
  }
  async startCursor(): Promise<string> {
    const row = object(await readJson(await this.request('changes/startPageToken', { supportsAllDrives: 'true' })))
    return cursor(row.startPageToken)!
  }
  async drainChanges(initial: string): Promise<string> {
    let page = initial
    const seen = new Set<string>()
    // Changes are principal-wide wake-up hints, never operational payloads. Only
    // the root-scoped full traversal below supplies file metadata/content.
    for (let count = 0; count < 20; count++) {
      if (seen.has(page)) throw new SyncFailure('invalid-source')
      seen.add(page)
      const row = object(await readJson(await this.request('changes', {
        pageToken: page, pageSize: '1000', spaces: 'drive', includeRemoved: 'true',
        supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
        fields: 'nextPageToken,newStartPageToken,changes(fileId,removed)',
      })))
      if (!Array.isArray(row.changes) || row.changes.length > 1_000) throw new SyncFailure('invalid-source')
      const next = cursor(row.nextPageToken, true)
      if (!next) return cursor(row.newStartPageToken)!
      page = next
    }
    // A very large principal-wide backlog must not permanently wedge the root.
    // Rebase BEFORE the mandatory complete root snapshot; its contents cover
    // all earlier root changes, while this token preserves subsequent changes.
    // This would be unsafe for a delta-only commit, which this worker never does.
    return this.startCursor()
  }
  async watch(pageToken: string, id: string, token: string, expiresAt: number): Promise<Channel> {
    const row = object(await readJson(await this.request('changes/watch', {
      pageToken, supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    }, { id, type: 'web_hook', address: `${STAGING_URL}/functions/v1/brain-sync/webhook`, token, expiration: String(expiresAt) }), 16_384))
    const expiration = typeof row.expiration === 'string' && /^\d{10,16}$/.test(row.expiration) ? Number(row.expiration) : NaN
    if (row.id !== id || typeof row.resourceId !== 'string' || !validResource(row.resourceId)
      || !Number.isSafeInteger(expiration) || expiration <= Date.now() || expiration > expiresAt) throw new SyncFailure('invalid-source')
    return { id, resourceId: row.resourceId, expiresAt: new Date(expiration).toISOString() }
  }
  async stop(channel: Channel): Promise<void> {
    const response = await this.request('channels/stop', {}, { id: channel.id, resourceId: channel.resourceId })
    await response.body?.cancel()
  }
  async content(id: string): Promise<Uint8Array> {
    if (!FILE_ID.test(id)) throw new SyncFailure('invalid-source')
    return readBytes(await this.request(`files/${id}`, { alt: 'media', supportsAllDrives: 'true' }), MAX_MANIFEST_BYTES)
  }
}

function cursor(value: unknown, optional = false): string | null {
  if (optional && (value === undefined || value === null)) return null
  if (typeof value !== 'string' || !value || value.length > 32_768 || /[\u0000-\u001f]/.test(value)) throw new SyncFailure('invalid-source')
  return value
}

function validResource(value: string): boolean { return value.length > 0 && value.length <= 1_024 && !/[\u0000-\u0020\u007f]/.test(value) }

function parseFile(value: unknown): DriveFile {
  const row = object(value)
  // A folder shared directly with this principal can omit its inaccessible
  // outside parent. Only the fixed root may be a parentless boundary.
  const parents = row.parents === undefined && row.id === ROOT_ID ? [] : row.parents
  if (typeof row.id !== 'string' || !FILE_ID.test(row.id) || typeof row.version !== 'string' || !SOURCE_VERSION.test(row.version)
    || !Array.isArray(parents) || parents.length > 20 || parents.some(id => typeof id !== 'string' || !FILE_ID.test(id))
    || new Set(parents).size !== parents.length || typeof row.trashed !== 'boolean') throw new SyncFailure('invalid-source')
  const modifiedTime = row.modifiedTime === undefined ? null : text(row.modifiedTime, 64)
  if (modifiedTime && !Number.isFinite(Date.parse(modifiedTime))) throw new SyncFailure('invalid-source')
  const size = typeof row.size === 'string' && /^\d{1,16}$/.test(row.size) ? Number(row.size) : null
  const capabilities = row.capabilities && typeof row.capabilities === 'object' ? row.capabilities as JsonObject : {}
  return {
    fileId: row.id, name: text(row.name, 1_024), mimeType: text(row.mimeType, 200), parents: parents as string[],
    version: row.version, modifiedTime, trashed: row.trashed, inScope: !row.trashed,
    size: size !== null && Number.isSafeInteger(size) ? size : null, canDownload: capabilities.canDownload === true,
  }
}

function eligibleName(name: string, directory: boolean): boolean {
  return !name.startsWith('.') && !name.includes('/') && !name.includes('\\') && !PRIVATE_NAME.test(name)
    && (!directory || (!SCRIPT_NAME.test(name) && !['node_modules', 'vendor'].includes(name.toLowerCase())))
}

function rootValid(file: DriveFile): boolean {
  return file.fileId === ROOT_ID && file.name === ROOT_NAME && file.mimeType === FOLDER_MIME && !file.trashed
}

function sameLocation(file: DriveFile, expected: DriveFile): boolean {
  return file.fileId === expected.fileId && file.name === expected.name && file.mimeType === expected.mimeType
    && !file.trashed && file.parents.length === expected.parents.length && file.parents.every((id, index) => id === expected.parents[index])
}

async function parallelFour<T, R>(values: readonly T[], callback: (value: T) => Promise<R>): Promise<R[]> {
  const output: R[] = []
  for (let index = 0; index < values.length; index += 4) {
    const results = await Promise.allSettled(values.slice(index, index + 4).map(callback))
    let failure: unknown
    for (const result of results) {
      if (result.status === 'fulfilled') output.push(result.value)
      else if (failure === undefined) failure = result.reason
    }
    if (failure !== undefined) throw failure
  }
  return output
}

function indexed(file: DriveFile): IndexedFile {
  const { fileId, name, mimeType, parents, version, modifiedTime, trashed, inScope } = file
  return { fileId, name, mimeType, parents, version, modifiedTime, trashed, inScope }
}

async function scanRoot(drive: Drive, budget: Budget): Promise<Snapshot> {
  const root = await drive.metadata(ROOT_ID)
  if (!rootValid(root)) throw new SyncFailure('invalid-source')
  const folders = new Map<string, Folder>([[ROOT_ID, { file: root, parentId: null, depth: 0 }]])
  const byId = new Map<string, DriveFile>([[ROOT_ID, root]])
  let wave = [folders.get(ROOT_ID)!]
  let entries = 0
  while (wave.length) {
    budget.checkpoint()
    const batches = await parallelFour(wave, async folder => {
      // Verify a known, root-discovered parent before listing its children.
      const current = await drive.metadata(folder.file.fileId)
      if (!sameLocation(current, folder.file) || (folder.parentId === null && !rootValid(current))) throw new SyncFailure('source-conflict')
      const children: DriveFile[] = []
      const pages = new Set<string>()
      let next: string | undefined
      do {
        const page = await drive.children(folder.file.fileId, next)
        entries += page.files.length
        if (entries > MAX_ENTRIES) throw new SyncFailure('invalid-source')
        for (const value of page.files) {
          const file = parseFile(value)
          if (file.trashed || file.parents.length !== 1 || file.parents[0] !== folder.file.fileId) throw new SyncFailure('source-conflict')
          const directory = file.mimeType === FOLDER_MIME
          if (!eligibleName(file.name, directory)) continue
          const note = /\.md$/i.test(file.name) && NOTE_MIMES.has(file.mimeType)
          // Eligible JSON is metadata-only until an operator explicitly binds
          // and selects one source. This permits safe metadata-first setup.
          const json = /\.json$/i.test(file.name) && JSON_MIMES.has(file.mimeType)
          if (directory || note || json) children.push(file)
        }
        if (page.next && pages.has(page.next)) throw new SyncFailure('invalid-source')
        if (page.next) pages.add(page.next)
        next = page.next ?? undefined
      } while (next)
      return { folder, children }
    })
    const following: Folder[] = []
    for (const { folder, children } of batches) {
      for (const file of children) {
        if (byId.has(file.fileId) || byId.size >= MAX_FILES) throw new SyncFailure('invalid-source')
        byId.set(file.fileId, file)
        if (file.mimeType === FOLDER_MIME) {
          if (folder.depth + 1 > MAX_DEPTH) throw new SyncFailure('invalid-source')
          const child = { file, parentId: folder.file.fileId, depth: folder.depth + 1 }
          folders.set(file.fileId, child)
          following.push(child)
        }
      }
    }
    wave = following
  }
  // Revalidate every discovered ancestor after the traversal. A moved folder
  // cannot turn an outside subtree into a successfully acknowledged snapshot.
  await parallelFour([...folders.values()], async folder => {
    const current = await drive.metadata(folder.file.fileId)
    if (!sameLocation(current, folder.file) || (folder.parentId === null && !rootValid(current))) throw new SyncFailure('source-conflict')
  })
  const files = [...byId.values()].map(indexed).sort((left, right) => left.fileId.localeCompare(right.fileId))
  if (encoder.encode(JSON.stringify(files)).byteLength > MAX_METADATA_BYTES) throw new SyncFailure('invalid-source')
  return { files, byId, folders }
}

async function verifyChain(drive: Drive, file: DriveFile, snapshot: Snapshot): Promise<void> {
  if (file.parents.length !== 1) throw new SyncFailure('source-conflict')
  let parentId: string | null = file.parents[0]!
  const visited = new Set<string>()
  while (parentId) {
    if (visited.has(parentId) || visited.size > MAX_DEPTH) throw new SyncFailure('source-conflict')
    visited.add(parentId)
    const folder = snapshot.folders.get(parentId)
    if (!folder) throw new SyncFailure('source-conflict')
    const current = await drive.metadata(parentId)
    if (!sameLocation(current, folder.file) || (parentId === ROOT_ID && !rootValid(current))) throw new SyncFailure('source-conflict')
    parentId = folder.parentId
  }
  if (!visited.has(ROOT_ID)) throw new SyncFailure('source-conflict')
}

function uuid(value: unknown): string {
  const id = text(value, 36)
  if (!UUID.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) throw new SyncFailure('invalid-source')
  return id
}

function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new SyncFailure('invalid-source')
  return value
}

function key(value: unknown): string {
  const result = text(value, 64)
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(result)) throw new SyncFailure('invalid-source')
  return result
}

function reviewSource(reference: string, snapshot: Snapshot): void {
  // References identify real in-scope evidence; their prose is not executed and
  // the bridge does not claim that a file is an authenticated review event.
  let id = reference
  if (!FILE_ID.test(id)) {
    let url: URL
    try { url = new URL(reference) } catch { throw new SyncFailure('invalid-source') }
    const match = /^\/file\/d\/([A-Za-z0-9_-]{10,200})(?:\/view)?\/?$/.exec(url.pathname)
    if (url.origin !== 'https://drive.google.com' || !match || url.username || url.password || url.search) throw new SyncFailure('invalid-source')
    id = match[1]!
  }
  const file = snapshot.byId.get(id)
  if (!file || file.mimeType === FOLDER_MIME || !/\.md$/i.test(file.name)) throw new SyncFailure('invalid-source')
}

function validateManifest(value: unknown, snapshot: Snapshot): JsonObject {
  const plan = exactShape(value, ['id', 'proposalKey', 'title', 'summary', 'body', 'departments', 'hiring', 'skills', 'hrReview', 'ceoReview'])
  const ids = new Set([uuid(plan.id).toLowerCase()])
  key(plan.proposalKey); text(plan.title, 200); text(plan.summary, 2_000); text(plan.body, 16_000)
  const itemId = (value: unknown): void => {
    const id = uuid(value).toLowerCase()
    if (ids.has(id)) throw new SyncFailure('invalid-source')
    ids.add(id)
  }
  const departmentKeys = new Set<string>()
  // Build the conservative metadata evidence set once, rather than rescanning
  // all indexed files for every skill request. This is not an execution roster.
  const employeeProfiles = new Set<string>()
  for (const file of snapshot.byId.values()) {
    if (!NOTE_MIMES.has(file.mimeType) || !/\.md$/i.test(file.name)) continue
    const match = /^(AG-[A-Z]+-[0-9]{3})(?=\s|[._-]|$)/.exec(file.name)
    if (match) employeeProfiles.add(match[1]!)
  }
  for (const value of array(plan.departments, 128)) {
    const row = exactShape(value, ['id', 'key', 'name'], ['nameAr'])
    itemId(row.id)
    const departmentKey = key(row.key)
    if (departmentKeys.has(departmentKey)) throw new SyncFailure('invalid-source')
    departmentKeys.add(departmentKey)
    text(row.name, 200)
    if (row.nameAr !== undefined && row.nameAr !== null) text(row.nameAr, 200)
  }
  for (const value of array(plan.hiring, 256)) {
    const row = exactShape(value, ['id', 'role', 'reason'], ['departmentId'])
    itemId(row.id); text(row.role, 200); text(row.reason, 4_000)
    if (row.departmentId !== undefined && row.departmentId !== null) uuid(row.departmentId)
  }
  for (const value of array(plan.skills, 256)) {
    const row = exactShape(value, ['id', 'employeeId', 'skill', 'reason'])
    itemId(row.id); text(row.skill, 200); text(row.reason, 4_000)
    const employeeId = text(row.employeeId, 80)
    if (!/^AG-[A-Z]+-[0-9]{3}$/.test(employeeId)) throw new SyncFailure('invalid-source')
    // Membership needs current source evidence, not a self-asserted manifest ID.
    if (!employeeProfiles.has(employeeId)) throw new SyncFailure('invalid-source')
  }
  for (const name of ['hrReview', 'ceoReview']) {
    const review = exactShape(plan[name], ['reference', 'summary'])
    reviewSource(text(review.reference, 2_000), snapshot)
    text(review.summary, 4_000)
  }
  return plan
}

async function publishManifest(cfg: Config, budget: Budget, drive: Drive, snapshot: Snapshot): Promise<void> {
  if (!cfg.manifestId) return
  const source = snapshot.byId.get(cfg.manifestId)
  if (!source || !/\.json$/i.test(source.name) || !JSON_MIMES.has(source.mimeType)) throw new SyncFailure('invalid-source')
  const before = await drive.metadata(source.fileId)
  if (!sameLocation(before, source) || !before.canDownload || before.size === null || before.size > MAX_MANIFEST_BYTES) throw new SyncFailure('source-conflict')
  await verifyChain(drive, before, snapshot)
  const bytes = await drive.content(before.fileId)
  let value: unknown
  try { value = JSON.parse(decoder.decode(bytes)) } catch { throw new SyncFailure('invalid-source') }
  const document = validateManifest(value, snapshot)
  const after = await drive.metadata(before.fileId)
  if (!sameLocation(after, before) || after.version !== before.version || after.size !== before.size || bytes.byteLength !== before.size) throw new SyncFailure('source-conflict')
  await verifyChain(drive, after, snapshot)
  await rpc(cfg, budget, 'hq_brain_publish_plan', {
    p_source_id: before.fileId, p_source_version: before.version, p_digest: await sha256(bytes),
    p_proposal_key: document.proposalKey, p_document: document,
  })
  // The chosen document may have advanced since its folder listing. Commit the
  // actual version whose bytes and ancestry were revalidated for publication.
  const index = snapshot.files.findIndex(file => file.fileId === after.fileId)
  if (index < 0) throw new SyncFailure('source-conflict')
  snapshot.files[index] = indexed(after)
}

async function ensureWatch(cfg: Config, budget: Budget, drive: Drive, previous: Channel | null, pageToken: string): Promise<void> {
  if (previous && Date.parse(previous.expiresAt) > Date.now() + RENEW_BEFORE_MS) return
  const id = crypto.randomUUID()
  const token = base64Url(crypto.getRandomValues(new Uint8Array(32)))
  const expiration = Date.now() + WATCH_MS
  await rpc(cfg, budget, 'hq_brain_channel_prepare', {
    p_channel_id: id, p_token_hash: await sha256(encoder.encode(token)), p_expires_at: new Date(expiration).toISOString(),
  })
  const channel = await drive.watch(pageToken, id, token, expiration)
  await rpc(cfg, budget, 'hq_brain_channel_confirm', {
    p_channel_id: id, p_resource_id: channel.resourceId, p_expires_at: channel.expiresAt,
  })
  // Overlapping confirmed channels are harmless. Stopping the previous channel
  // is best-effort; database expiry and exact token/resource matching remain the
  // authority if this optional cleanup fails.
  if (previous) await drive.stop(previous).catch(() => undefined)
}

/** Scheduled channel maintenance never lists files or reads the changes feed. */
async function renewWatch(cfg: Config): Promise<JsonObject> {
  const budget = new Budget()
  const drive = new Drive(await googleToken(cfg, budget), budget)
  // A new start token is needed to create a watch, but it does not consume or
  // advance the durable data cursor. Actual 'change' notifications do that.
  const cursor = await drive.startCursor()
  await ensureWatch(cfg, budget, drive, null, cursor)
  return { ok: true, status: 'watch-renewed' }
}

function parseClaim(value: unknown): Claim {
  const claim = object(value)
  if (typeof claim.claimed !== 'boolean' || claim.rootId !== ROOT_ID || typeof claim.fullReconcile !== 'boolean'
    || !Number.isSafeInteger(claim.generation) || Number(claim.generation) < 1) throw new SyncFailure('configuration-required')
  let channel: Channel | null = null
  if (claim.channel !== null && claim.channel !== undefined) {
    const row = object(claim.channel)
    if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.resourceId !== 'string' || !validResource(row.resourceId)
      || typeof row.expiresAt !== 'string' || !Number.isFinite(Date.parse(row.expiresAt))) throw new SyncFailure('configuration-required')
    channel = { id: row.id, resourceId: row.resourceId, expiresAt: row.expiresAt }
  }
  const leaseExpiresAt = typeof claim.leaseExpiresAt === 'string' ? claim.leaseExpiresAt : null
  if (claim.claimed && (!leaseExpiresAt || !Number.isFinite(Date.parse(leaseExpiresAt))
    || Date.parse(leaseExpiresAt) < Date.now() + RUN_MS)) throw new SyncFailure('lease-lost')
  return {
    claimed: claim.claimed, rootId: ROOT_ID, cursor: cursor(claim.cursor, true), generation: Number(claim.generation),
    fullReconcile: claim.fullReconcile, leaseExpiresAt, channel,
  }
}

async function runWorker(cfg: Config): Promise<JsonObject> {
  const owner = crypto.randomUUID()
  const budget = new Budget()
  let claimed = false
  try {
    const rawClaim = await rpc<unknown>(cfg, budget, 'hq_brain_sync_claim', { p_owner: owner })
    claimed = Boolean(rawClaim && typeof rawClaim === 'object' && (rawClaim as JsonObject).claimed === true)
    const claim = parseClaim(rawClaim)
    claimed = claim.claimed
    if (!claimed) return { ok: true, status: 'queued' }
    const drive = new Drive(await googleToken(cfg, budget), budget)
    // Obtain the cursor BEFORE reading the root, closing the initial-scan gap.
    // A cursor-expired failure is durably reset by fail() and retried from a new
    // token; no partial snapshot or old cursor is acknowledged in that attempt.
    const initial = claim.cursor ?? await drive.startCursor()
    const nextCursor = await drive.drainChanges(initial)
    await ensureWatch(cfg, budget, drive, claim.channel, nextCursor)
    const snapshot = await scanRoot(drive, budget)
    await publishManifest(cfg, budget, drive, snapshot)
    budget.checkpoint()
    const result = object(await rpc(cfg, budget, 'hq_brain_sync_commit', {
      p_owner: owner, p_cursor: nextCursor, p_generation: claim.generation, p_files: snapshot.files, p_complete: true,
    }))
    if (result.committed !== true) throw new SyncFailure('lease-lost')
    return { ok: true, status: 'synced', fileCount: snapshot.files.length, pending: result.pending === true }
  }
  catch (error) {
    const failure = error instanceof SyncFailure ? error : new SyncFailure('cloud-unavailable')
    if (claimed) {
      // Separate small cleanup budget: an expired scan deadline must not prevent
      // durable release/backoff. A lost response is safe; the lease expires.
      await rpc(cfg, new Budget(), 'hq_brain_sync_fail', { p_owner: owner, p_reason: failure.reason }).catch(() => undefined)
    }
    throw failure
  }
}

async function workerToken(request: Request): Promise<string | null> {
  const header = request.headers.get('X-HQ-Brain-Sync-Token')
  if (header !== null) {
    await request.body?.cancel().catch(() => undefined)
    return TOKEN_PATTERN.test(header) ? header : null
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  try {
    const response = new Response(request.body, { headers: request.headers })
    const bytes = await readBytes(response, 4_096, 5_000)
    const row = exactShape(JSON.parse(decoder.decode(bytes)), ['token'])
    return typeof row.token === 'string' && TOKEN_PATTERN.test(row.token) ? row.token : null
  }
  catch { return null }
}

function reply(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

Deno.serve(async (request: Request) => {
  try {
    if (request.method !== 'POST') return reply(405, { ok: false })
    const route = /\/(?:functions\/v1\/)?brain-sync\/(run|renew|webhook)\/?$/.exec(new URL(request.url).pathname)?.[1]
    if (!route) return reply(404, { ok: false })
    const cfg = config()
    if (route === 'run' || route === 'renew') {
      const token = await workerToken(request)
      if (!token) return reply(401, { ok: false })
      const allowed = await rpc<unknown>(cfg, new Budget(), 'hq_brain_authorize_worker', { p_token_hash: await sha256(encoder.encode(token)) })
      if (allowed !== true) return reply(401, { ok: false })
      return reply(200, await (route === 'renew' ? renewWatch(cfg) : runWorker(cfg)))
    }
    const id = request.headers.get('X-Goog-Channel-ID') ?? ''
    const token = request.headers.get('X-Goog-Channel-Token') ?? ''
    const resourceId = request.headers.get('X-Goog-Resource-ID') ?? ''
    const state = request.headers.get('X-Goog-Resource-State')
    await request.body?.cancel().catch(() => undefined)
    if (!UUID.test(id) || !TOKEN_PATTERN.test(token) || !validResource(resourceId) || !['sync', 'change'].includes(state ?? '')) return reply(403, { ok: false })
    // Initial watch handshakes contain no file change. A renewal must not turn
    // into a scheduled source refresh; only actual changes enqueue data work.
    if (state === 'sync') return reply(202, { ok: true })
    await rpc<unknown>(cfg, new Budget(), 'hq_brain_notify', {
      p_channel_id: id, p_token_hash: await sha256(encoder.encode(token)), p_resource_id: resourceId,
    })
    // The transaction durably dispatches pending work through pg_net. A process
    // disappearing after this acknowledgment cannot drop an in-memory task.
    // One-shot retries/lease recovery exist only while actual work is pending.
    return reply(202, { ok: true })
  }
  catch (error) {
    const failure = error instanceof SyncFailure ? error : new SyncFailure('cloud-unavailable')
    return reply(failure.status, { ok: false, reason: failure.reason })
  }
})
