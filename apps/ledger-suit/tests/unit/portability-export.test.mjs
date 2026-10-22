import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { exportOrganizationPortability } from '../../scripts/export-organization-portability.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function fixture(t, { invalidChecksum = false } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ledger-portability-export-'))
  const organizationId = randomUUID()
  const objectKey = `${organizationId}/organization/${organizationId}/receipt.png`
  const bytes = Buffer.from([0, 255, 128, 9])
  const ranges = []
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const table = url.pathname.split('/').at(-1)
    if (url.pathname === '/rest/v1/rpc/my_capabilities') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(['exports.create'])); return
    }
    if (url.pathname === '/rest/v1/rpc/export_financial_report_csv') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify('Date,المبلغ\n2026-10-22,90071992547409.93\n')); return
    }
    if (url.pathname.startsWith('/storage/v1/object/authenticated/attachments/')) {
      response.setHeader('Content-Type', 'image/png'); response.end(bytes); return
    }
    response.setHeader('Content-Type', 'application/json')
    if (table === 'accounts') {
      const start = Number(request.headers.range.split('-')[0])
      ranges.push(start)
      const count = start === 0 ? 1000 : 1
      response.setHeader('Content-Range', `${start}-${start + count - 1}/1001`)
      response.end(JSON.stringify(Array.from({ length: count }, (_, i) => ({ id: String(start + i), organization_id: organizationId })))); return
    }
    if (table === 'transaction_entries') {
      response.setHeader('Content-Range', '0-0/1')
      response.end(`[{"id":"${randomUUID()}","base_amount_minor":9007199254740993}]`); return
    }
    if (table === 'attachments') {
      response.setHeader('Content-Range', '0-0/1')
      response.end(JSON.stringify([{ id: randomUUID(), organization_id: organizationId, storage_bucket: 'attachments',
        storage_key: objectKey, file_name: 'receipt.png', mime_type: 'image/png', size_bytes: bytes.length,
        checksum: invalidChecksum ? '0'.repeat(64) : hash(bytes) }])); return
    }
    response.setHeader('Content-Range', '*/0'); response.end('[]')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }) })
  return { bytes, objectKey, ranges, options: { baseUrl: `http://127.0.0.1:${server.address().port}`,
    key: 'synthetic-key', token: 'synthetic-token', organizationId, environmentId: 'unit-portability',
    fromDate: '2026-01-01', toDate: '2026-12-31', output: path.join(directory, 'export') } }
}

test('portability writes exact paginated JSON, report and binary bytes with verifiable disk hashes', async (t) => {
  const { bytes, objectKey, ranges, options } = await fixture(t)
  const manifest = await exportOrganizationPortability(options)
  assert.deepEqual(ranges, [0, 1000])
  assert.equal(manifest.tables.find(table => table.table === 'accounts').rows, '1001')
  for (const item of [...manifest.tables.flatMap(table => table.files), ...manifest.reports]) {
    assert.equal(hash(await readFile(path.join(options.output, item.path))), item.sha256, item.path)
  }
  const entries = manifest.tables.find(table => table.table === 'transaction_entries')
  assert.match(await readFile(path.join(options.output, entries.files[0].path), 'utf8'), /9007199254740993/)
  const attachmentBytes = await readFile(path.join(options.output, 'attachments-manifest.json'))
  assert.equal(hash(attachmentBytes), manifest.attachment_manifest_sha256)
  const attachmentManifest = JSON.parse(attachmentBytes)
  assert.equal(attachmentManifest.objects[0].sha256, hash(bytes))
  assert.deepEqual(await readFile(path.join(options.output, 'attachments', ...objectKey.split('/'))), bytes)
  await assert.rejects(exportOrganizationPortability(options), /refusing to overwrite/)
})

test('portability rejects same-size attachment corruption without a completion manifest', async (t) => {
  const { options } = await fixture(t, { invalidChecksum: true })
  await assert.rejects(exportOrganizationPortability(options), /attachment checksum mismatch/)
  await assert.rejects(readFile(path.join(options.output, 'manifest.json')), { code: 'ENOENT' })
})
