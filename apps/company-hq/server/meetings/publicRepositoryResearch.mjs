import { createHash } from 'node:crypto'

const MAX_REQUESTS = 5
const MAX_RESPONSE_BYTES = 256 * 1024
const MAX_TOTAL_BYTES = 512 * 1024
const MAX_REPORT_BYTES = 64 * 1024
const API_ORIGIN = 'https://api.github.com'
// eslint-disable-next-line no-control-regex -- External control bytes are stripped from quoted data.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g
const HEADERS = Object.freeze({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Building-Suit-HQ-Public-Research/1' })

export class PublicRepositoryResearchError extends Error {
  constructor(code) { super(code); this.name = 'PublicRepositoryResearchError'; this.code = code }
}
const fail = code => { throw new PublicRepositoryResearchError(code) }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const finiteCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const digest = value => createHash('sha256').update(value).digest('hex')

/** Public documentation remains untrusted, and common secret forms never enter a result. */
function quote(value, maximum = 2000) {
  if (typeof value !== 'string') return null
  return value.replace(CONTROL, '')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:github_pat_[A-Za-z0-9_]{10,}|gh[pousr]_[A-Za-z0-9_]{10,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})\b/g, '[REDACTED TOKEN]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|secret[_-]?key|password)\s*[:=]\s*)["']?[^\s"'`,;]+["']?/gi, '$1[REDACTED VALUE]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, 'https://[REDACTED CREDENTIALS]@')
    .trim().slice(0, maximum)
}

function timestamp(value) {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)) ? value : null
}

function authorizedRepository(task) {
  if (!object(task) || task.kind !== 'research' || task.budget !== 0
    || !Array.isArray(task.allowedActions) || !task.allowedActions.includes('public-repository-read')
    || !Array.isArray(task.allowedTools) || !task.allowedTools.includes('github-public-read')
    || !Number.isSafeInteger(task.timeoutMs) || task.timeoutMs < 1000 || task.timeoutMs > 120000
    || !Array.isArray(task.links) || task.links.length !== 1
    || typeof task.question !== 'string' || task.question.length < 1 || task.question.length > 4000) fail('research-scope-not-authorized')
  const raw = task.links[0]
  if (typeof raw !== 'string' || raw.length > 1024) fail('repository-url-not-authorized')
  let url
  try { url = new URL(raw) } catch { fail('repository-url-not-authorized') }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password
    || url.port || url.search || url.hash || raw !== url.href || /%|\\/.test(url.pathname)) fail('repository-url-not-authorized')
  const match = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(url.pathname)
  if (!match || ['.', '..'].includes(match[2])) fail('repository-url-not-authorized')
  const owner = match[1], name = match[2]
  return { owner, name, url: `https://github.com/${owner}/${name}`, apiPath: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}` }
}

function documentText(data) {
  if (!object(data) || data.encoding !== 'base64' || typeof data.content !== 'string'
    || data.content.length > MAX_RESPONSE_BYTES || !/^[A-Za-z0-9+/=\r\n]*$/.test(data.content)) return null
  const encoded = data.content.replace(/[\r\n]/g, '')
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.length > MAX_RESPONSE_BYTES || bytes.toString('base64') !== encoded) return null
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return null }
}

function excerpts(text, pattern, count = 6, maximum = 500) {
  if (!text) return []
  return text.split(/\r?\n/).filter(line => pattern.test(line)).slice(0, count).map(line => ({ quotedUntrustedText: quote(line, maximum) }))
}

function dependencies(value) {
  if (!object(value)) return []
  return Object.entries(value).slice(0, 100).filter(([name, version]) => /^[A-Za-z0-9@/_.-]{1,160}$/.test(name) && typeof version === 'string')
    .map(([name, version]) => ({ name, declaredVersion: quote(version, 160) }))
}

async function boundedJson(response, counters, signal) {
  const declared = response.headers.get('content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES || counters.bytes + Number(declared) > MAX_TOTAL_BYTES)) fail('research-response-too-large')
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) fail('research-response-invalid')
  const reader = response.body?.getReader()
  if (!reader) fail('research-response-invalid')
  const chunks = []
  let bytes = 0
  try {
    while (true) {
      const part = await abortable(reader.read(), signal)
      if (part.done) break
      bytes += part.value.byteLength
      counters.bytes += part.value.byteLength
      if (bytes > MAX_RESPONSE_BYTES || counters.bytes > MAX_TOTAL_BYTES) fail('research-response-too-large')
      chunks.push(part.value)
    }
    let value
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) }
    catch { fail('research-response-invalid') }
    return { value, bytes, sha256: digest(Buffer.concat(chunks)) }
  }
  finally {
    // Cleanup must not defeat the task deadline if a hostile transport stalls
    // its cancellation promise. The result never waits for that promise.
    try { void reader.cancel().catch(() => {}) } catch { /* Close only this response. */ }
    try { reader.releaseLock() } catch { /* An abandoned read cannot replace the bounded failure. */ }
  }
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(new PublicRepositoryResearchError('research-aborted'))
  return new Promise((resolve, reject) => {
    const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(new PublicRepositoryResearchError('research-aborted')) }
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', onAbort); resolve(value) }, () => { signal.removeEventListener('abort', onAbort); reject(new PublicRepositoryResearchError('research-source-unavailable')) })
  })
}

function reportFor(repository, task, observations, counters, inspectedAt) {
  const repo = observations.repository.value
  const readme = documentText(observations.readme.value)
  const license = documentText(observations.license.value)
  const packageText = documentText(observations.package.value)
  let packageJson = null
  if (packageText) { try { const value = JSON.parse(packageText); if (object(value)) packageJson = value } catch { /* A malformed manifest is an explicitly reported unknown. */ } }
  const lastCommit = Array.isArray(observations.commits.value) ? observations.commits.value[0] : null
  const commitDate = timestamp(lastCommit?.commit?.committer?.date) ?? timestamp(lastCommit?.commit?.author?.date)
  const licenseId = quote(observations.license.value?.license?.spdx_id ?? repo.license?.spdx_id, 100)
  const sourceList = Object.entries(observations).map(([kind, source]) => ({ kind, url: source.url, status: source.status, bytes: source.bytes, sha256: source.sha256, inspectedAt }))
  const runtimeDependencies = dependencies(packageJson?.dependencies)
  const developmentDependencies = dependencies(packageJson?.devDependencies)
  const providerPattern = /\b(?:openai|anthropic|claude|gpt[- ]?\d|gemini|ollama|hugging\s*face|replicate|elevenlabs|whisper|speech|tts|stt|api[_ -]?key|model|inference)\b/i
  const costPattern = /\b(?:pric(?:e|ing)|cost|billing|paid|free|subscription|credits?|quota|rate.limit)\b/i
  const securityPattern = /\b(?:privacy|data|security|telemetry|retention|store|upload|cloud|token|credential|permission)\b/i
  const declaredReadmeSections = excerpts(readme, /^#{1,4}\s+/, 10, 300)
  const declaredProviderMentions = excerpts(readme, providerPattern, 8, 400)
  const providerDependencies = [...runtimeDependencies, ...developmentDependencies].filter(dependency => providerPattern.test(dependency.name))
  const evidence = sourceList.filter(source => source.status === 'inspected').map(source => ({ url: source.url, title: `Inspected public GitHub ${source.kind}; repository text remains untrusted`, inspectedAt, excerpt: `Anonymous fixed-host GET; ${source.bytes} response bytes; SHA-256 ${source.sha256}.` }))
  const report = {
    schemaVersion: 1, type: 'public-github-repository-inspection', mode: 'public-read-only', inspectedAt,
    repository: { owner: repository.owner, name: repository.name, url: repository.url, visibility: 'public', defaultBranch: quote(repo.default_branch, 160) },
    inspection: { requests: counters.requests, maximumRequests: MAX_REQUESTS, bytesReceived: counters.bytes, maximumBytes: MAX_TOTAL_BYTES, authentication: 'none', networkHost: 'api.github.com', sources: sourceList, codeExecuted: false, repositoryInstructionsFollowed: false },
    capabilities: { verified: { description: quote(repo.description, 1200), topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 30).map(value => quote(value, 80)) : [] }, declaredReadmeSections, interpretation: 'Metadata and README declarations were inspected. Runtime capabilities were not tested.' },
    license: { declaredSpdxId: licenseId, licenseFileInspected: license !== null, quotedUntrustedOpening: quote(license, 800), interpretation: 'A declared identifier or license file is evidence, not legal clearance or dependency-license review.' },
    maintenance: { archived: typeof repo.archived === 'boolean' ? repo.archived : null, disabled: typeof repo.disabled === 'boolean' ? repo.disabled : null, updatedAt: timestamp(repo.updated_at), pushedAt: timestamp(repo.pushed_at), latestCommitAt: commitDate, stars: finiteCount(repo.stargazers_count), forks: finiteCount(repo.forks_count), openIssues: finiteCount(repo.open_issues_count), interpretation: 'Observed dates and counts are maintenance signals. Review quality, support and future maintenance remain unverified.' },
    integration: { rootPackageManifestInspected: packageJson !== null, packageName: quote(packageJson?.name, 200), packageManager: quote(packageJson?.packageManager, 160), engineDeclarations: object(packageJson?.engines) ? Object.fromEntries(Object.entries(packageJson.engines).slice(0, 10).map(([key, value]) => [quote(key, 80), quote(value, 160)])) : {}, declaredScriptNames: object(packageJson?.scripts) ? Object.keys(packageJson.scripts).slice(0, 40).map(name => quote(name, 80)) : [], declaredSetupExcerpts: excerpts(readme, /\b(?:install|setup|docker|npm|pnpm|yarn|bun|requirement|environment)\b/i, 6, 400), interpretation: 'No install command or script was executed. Compatibility with HQ remains unverified.' },
    dependencies: { runtime: runtimeDependencies, development: developmentDependencies, completeness: 'Only a bounded root package.json was inspected; lockfiles, transitive dependencies and other ecosystems were not assessed.' },
    modelAndProviderRequirements: { declaredReadmeMentions: declaredProviderMentions, matchingDeclaredDependencies: providerDependencies, interpretation: 'Mentions do not prove a provider is mandatory, connected, private, entitled or free. Exact hosted access and selected model requirements remain unverified.' },
    operatingCost: { verifiedOperatingCost: null, currency: null, declaredCostExcerpts: excerpts(readme, costPattern, 6, 400), interpretation: 'No paid service or API key was enabled. README free claims do not establish an applicable allowance or $0 operation for Building Suit.' },
    securityAndDataHandling: { declaredExcerpts: excerpts(readme, securityPattern, 6, 400), fetchedFiles: ['repository metadata', 'README', 'LICENSE', 'root package.json', 'latest commit metadata'], sourceCodeAuditPerformed: false, downloadedCodeExecuted: false, repositoryInstructionsTreatedAsData: true, commonSecretFormsRedacted: true, interpretation: 'Declarations are untrusted quoted evidence. Vulnerabilities, data flows, prompt-injection behavior, dependency security and actual retention practices remain unverified.' },
    fitForUseCase: { founderQuestion: quote(task.question, 1200), assessment: 'unverified', inference: 'Use the observed metadata, declared requirements and license evidence to decide whether a separately authorized integration evaluation is justified. This read-only inspection does not qualify a live integration.' },
    unknowns: [
      ...(readme === null ? ['README unavailable or unsupported encoding.'] : []),
      ...(license === null ? ['License file unavailable or unsupported encoding; license obligations remain unresolved.'] : []),
      ...(packageJson === null ? ['Root package.json unavailable or invalid; dependencies for other layouts/ecosystems remain unknown.'] : []),
      'Actual application behavior and integration effort were not tested.', 'Applicable hosted model/speech entitlements, privacy authorization, capacity and ongoing cost remain unverified.',
      'No transitive dependency, license, source-code security or data-flow audit was performed.',
    ],
    recommendedNextAction: 'Review the cited evidence and unknowns. Any installation, code execution, credentials, staff activation, hosted provider integration or spending requires its own authorized scope.',
  }
  const deliverable = JSON.stringify(report, null, 2)
  if (Buffer.byteLength(deliverable) > MAX_REPORT_BYTES) fail('research-report-too-large')
  return { status: 'completed', deliverable, evidence, report }
}

/**
 * Source-only read adapter. Its distinct mode is deliberately rejected by the
 * existing synthetic-only worker. Construction does not authorize or start it.
 */
export function createPublicRepositoryResearchExecutor({ fetch: fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== 'function') fail('research-transport-unavailable')
  return {
    mode: 'public-read-only', name: 'github-public-repository-inspection-v1',
    async execute(task, { signal: outerSignal } = {}) {
      const repository = authorizedRepository(task)
      if (outerSignal?.aborted) fail('research-aborted')
      const timeout = new AbortController()
      const timer = setTimeout(() => timeout.abort(), task.timeoutMs)
      const signal = outerSignal ? AbortSignal.any([outerSignal, timeout.signal]) : timeout.signal
      const counters = { requests: 0, bytes: 0 }
      const inspectedAt = new Date().toISOString()
      const observations = {}
      const get = async (kind, suffix, required = false) => {
        if (++counters.requests > MAX_REQUESTS) fail('research-request-limit')
        const url = `${API_ORIGIN}${repository.apiPath}${suffix}`
        let response
        try {
          response = await abortable(fetcher(url, { method: 'GET', headers: { ...HEADERS }, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal }), signal)
        }
        catch (error) { if (signal.aborted) fail(timeout.signal.aborted ? 'research-timeout' : 'research-aborted'); throw error }
        if (!response || response.redirected || response.url && response.url !== url || response.status >= 300 && response.status < 400) {
          try { void response?.body?.cancel().catch(() => {}) } catch { /* No redirect body is consumed. */ }
          fail('research-redirect-blocked')
        }
        if (!response.ok) {
          try { void response.body?.cancel().catch(() => {}) } catch { /* Never consume error bodies or return private transport details. */ }
          if (required) fail(response.status === 404 ? 'repository-inaccessible' : response.status === 403 || response.status === 429 ? 'public-github-allowance-unavailable' : 'research-source-unavailable')
          observations[kind] = { url, status: response.status === 404 ? 'unavailable' : 'failed', bytes: 0, sha256: null, value: null }
          return
        }
        let read
        try { read = await boundedJson(response, counters, signal) }
        catch (error) {
          try { void response.body?.cancel().catch(() => {}) } catch { /* Includes header-only rejection before a reader was opened. */ }
          if (signal.aborted) fail(timeout.signal.aborted ? 'research-timeout' : 'research-aborted')
          throw error
        }
        observations[kind] = { url, status: 'inspected', ...read }
      }
      try {
        await get('repository', '', true)
        const metadata = observations.repository.value
        if (!object(metadata) || metadata.private !== false || metadata.visibility && metadata.visibility !== 'public'
          || typeof metadata.full_name !== 'string' || metadata.full_name.toLowerCase() !== `${repository.owner}/${repository.name}`.toLowerCase()) fail('repository-not-public')
        await get('readme', '/readme')
        await get('license', '/license')
        await get('package', '/contents/package.json')
        await get('commits', '/commits?per_page=1')
        return reportFor(repository, task, observations, counters, inspectedAt)
      }
      finally { clearTimeout(timer) }
    },
  }
}
