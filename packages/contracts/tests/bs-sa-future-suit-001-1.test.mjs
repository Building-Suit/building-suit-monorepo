import test from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/future-suit.ts', import.meta.url))
function diagnostics(extra = '') {
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, allowImportingTsExtensions: true }
  const host = ts.createCompilerHost(options)
  const read = host.readFile.bind(host)
  host.readFile = path => path === fixture ? read(path) + extra : read(path)
  return ts.getPreEmitDiagnostics(ts.createProgram([fixture], options, host))
}
test('public contract compiles typed future Suit adapters', () => {
  assert.deepEqual(diagnostics().map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
})
test('type contract rejects incompatible versions, inputs, results and unregistered operations', () => {
  for (const invalid of [
    'const bad: NonNullable<typeof futureSuit.capabilities.read.overview> = { version: 2, label: "bad" };',
    'const bad: NonNullable<typeof futureSuit.adapters.read.overview> = { version: 1, execute: async () => ({ total: "bad" }) };',
    'futureSuit.adapters.read.overview?.execute({ id: "bad" }, {});',
    'const bad: typeof futureSuit.capabilities.command = { delete: { version: 1, label: "bad" } };',
    'futureSuit.contractVersion = 2;',
  ]) assert.ok(diagnostics('\n' + invalid).length > 0, invalid)
})
