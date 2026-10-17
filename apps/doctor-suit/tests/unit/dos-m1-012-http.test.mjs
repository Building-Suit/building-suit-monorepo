import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { doctorOversizedResponse } from '../oversized-http.mjs'
async function fixture(continueFirst,status) {
  let received = 0
  const server = http.createServer()
  server.on('checkContinue',(request,response) => {
    request.on('error',() => undefined)
    if (!continueFirst) { response.writeHead(status).end(); return }
    response.writeContinue(); request.on('data',chunk => { received+=chunk.length }); request.on('end',() => response.writeHead(status).end())
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  try { const address = server.address(); const result = await doctorOversizedResponse(`http://127.0.0.1:${address.port}/functions/v1/doctor-documents?op=upload`,{ 'Content-Type': 'application/pdf' },new Uint8Array(5242881)); return { result,received } }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
}
test('actual HTTP fixture captures an early 413 before writing oversized bytes',async () => { assert.deepEqual(await fixture(false,413),{ result: 413,received: 0 }) })
test('actual HTTP fixture also captures denial after the server consumes the body',async () => { assert.deepEqual(await fixture(true,413),{ result: 413,received: 5242881 }) })
test('a successful response stays successful and cannot be relabelled a size denial',async () => { assert.deepEqual(await fixture(false,200),{ result: 200,received: 0 }) })
test('owned oversized transport rejects remote, ambiguous and differently shaped targets',() => {
  const bytes = new Uint8Array(5242881)
  assert.throws(() => doctorOversizedResponse('https://example.com/functions/v1/doctor-documents?op=upload',{},bytes))
  assert.throws(() => doctorOversizedResponse('http://127.0.0.1/other',{},bytes))
  assert.throws(() => doctorOversizedResponse('http://127.0.0.1/functions/v1/doctor-documents?op=upload',{},new Uint8Array(8)))
})
