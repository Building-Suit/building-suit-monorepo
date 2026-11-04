import type { BrainAdapter } from './hqRunner'
import { digest, requireWorkflow } from './hqWorkflow'
import { protocolDeadline, protocolText } from './hqProtocolHttp'
import type { ProtocolTransport } from './hqProtocolHttp'

/** Exact approved IDs only. Host transport must authorize every HTTP request afresh.
 * No filename search, links/shortcuts, offline cache, OAuth setup or credential discovery.
 */
export class DriveBrainAdapter implements BrainAdapter {
  private files: Set<string>
  constructor(ids: readonly string[], private transport: ProtocolTransport, private timeoutMs = 30_000) {
    requireWorkflow(ids.length > 0 && ids.length <= 64 && ids.every(id => /^[A-Za-z0-9_-]{1,120}$/.test(id)) && new Set(ids).size === ids.length, 'DRIVE_SCOPE_INVALID')
    this.files = new Set(ids)
    requireWorkflow(Number.isSafeInteger(timeoutMs) && timeoutMs >= 50 && timeoutMs <= 60_000, 'DRIVE_DEADLINE_INVALID')
  }
  async read(id: string, options: { cache: 'no-store'; signal: AbortSignal }) {
    requireWorkflow(this.files.has(id) && options.cache === 'no-store', 'DRIVE_SCOPE_DENIED')
    return protocolDeadline(options.signal, this.timeoutMs, async (signal, check) => {
      const base = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id)
      const metadataUrl = base + '?fields=id,mimeType,version,trashed,capabilities(canDownload)&supportsAllDrives=true'
      const init = { method: 'GET', signal, headers: { 'Cache-Control': 'no-cache, no-store', Accept: 'application/json' } }
      const metadata = async () => {
        const data = JSON.parse(await protocolText(this.transport, metadataUrl, init, 16_384, check))
        requireWorkflow(data && data.id === id && data.trashed === false && data.capabilities?.canDownload === true && typeof data.version === 'string' && /^\d{1,20}$/.test(data.version), 'DRIVE_METADATA_DENIED')
        requireWorkflow(['text/plain', 'text/markdown', 'application/vnd.google-apps.document'].includes(data.mimeType), 'DRIVE_TYPE_DENIED')
        return { version: data.version as string, mimeType: data.mimeType as string }
      }
      const before = await metadata()
      const url = before.mimeType === 'application/vnd.google-apps.document' ? base + '/export?mimeType=text%2Fplain' : base + '?alt=media&supportsAllDrives=true'
      const text = await protocolText(this.transport, url, { ...init, headers: { ...init.headers, Accept: 'text/plain' } }, 160_000, check)
      requireWorkflow(text.trim() && text.length <= 40_000, 'DRIVE_TEXT_INVALID')
      const after = await metadata(); check()
      requireWorkflow(before.version === after.version && before.mimeType === after.mimeType, 'DRIVE_CHANGED_DURING_READ')
      return { id, revision: before.version + ':' + digest(text), text, accessedAt: new Date().toISOString() }
    })
  }
}
