import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { createSicsScale } from '../src/controllers/createSicsScale.ts'
const options = { baudRate:9600,dataBits:8,stopBits:1,parity:'none',flowControl:'none' }
const frame = (id,state,value,unit='kg') => `${id} ${state} ${value.padStart(10,' ')} ${unit}\r\n`
function fixture(overrides = {}) {
  let incoming, tareReads = 0
  const device = { opens:0,closes:0,commands:[],options:null,live:true }
  const reply = raw => { if (raw === undefined) return; if (Array.isArray(raw)) raw = raw.join(''); try { incoming.enqueue(new TextEncoder().encode(raw)) } catch { /* A cancelled old device cannot emit usable data. */ } }
  const port = {
    readable:new ReadableStream({start(controller){incoming=controller},cancel(){device.live=false}}),
    writable:new WritableStream({write(bytes){
      const command=new TextDecoder().decode(bytes);assert.ok(command.endsWith('\r\n'));device.commands.push(command.slice(0,-2))
      const name=command.slice(0,-2)
      const standard=name==='I4'?'I4 A "TEST-SCALE-001"\r\n':name==='I0'?['I0 B 0 "S"\r\n','I0 B 1 "TA"\r\n','I0 A 1 "T"\r\n']:name==='TA'?frame('TA','A','0.125'):name==='S'?frame('S','S','0.25'):frame('T','S','0.125')
      if(name==='TA')tareReads++
      queueMicrotask(()=>reply(Object.hasOwn(overrides,name)?typeof overrides[name]==='function'?overrides[name]({tareReads,device}):overrides[name]:standard))
    }}),
    async open(selected){device.opens++;device.options=selected},
    async close(){assert.equal(port.readable.locked,false);assert.equal(port.writable.locked,false);device.closes++},
  }
  const access=new EventTarget();access.requestPort=async()=>port
  return {port,access,device,reply}
}
async function settled(controller) { for(let n=0;n<100&&controller.getState().status==='disconnecting';n++)await delay(1) }
test('one-flight MT-SICS handshake, stable tare/net reading and explicitly confirmed tare', async t => {
  const f=fixture(),controller=createSicsScale({serial:f.access});t.after(()=>controller.disconnect())
  await controller.connect(options,'TEST-SCALE-001')
  assert.deepEqual(f.device.commands,['I4','I0']);assert.deepEqual(f.device.options,options);assert.equal(controller.getState().canTare,true)
  const reading=await controller.read();assert.equal(reading.net,'0.25');assert.equal(reading.tare,'0.125');assert.equal(reading.gross,'0.375')
  assert.deepEqual(f.device.commands,['I4','I0','TA','S','TA'])
  reading.net='999';const copy=controller.getState();copy.reading.net='888';assert.equal(controller.currentReading().net,'0.25')
  await assert.rejects(controller.tare(),/SCALE_TARE_CONFIRMATION_REQUIRED/);assert.equal(f.device.commands.includes('T'),false)
  await controller.tare(true);assert.equal(f.device.commands.at(-1),'T');assert.equal(controller.getState().reading,null)
  assert.equal(f.device.commands.includes('@'),false);assert.equal(f.device.commands.includes('Z'),false)
})
test('device identity and required capabilities fail before any weighing command', async () => {
  for(const [overrides,serial,error] of [[{},'DIFFERENT-SCALE','SCALE_IDENTITY_MISMATCH'],[{I0:'I0 A 0 "S"\r\n'},'TEST-SCALE-001','SCALE_CAPABILITIES_UNAVAILABLE']]) {
    const f=fixture(overrides),controller=createSicsScale({serial:f.access})
    await assert.rejects(controller.connect(options,serial),new RegExp(error));assert.equal(f.device.commands.includes('S'),false)
    assert.equal(controller.getState().reading,null);assert.equal(f.device.closes,1);assert.equal(controller.getState().canConnect,true)
  }
})
test('unstable/overload reads offer a retry and never retain an earlier usable value', async t => {
  let response=frame('S','D','0.25');const f=fixture({S:()=>response}),controller=createSicsScale({serial:f.access});t.after(()=>controller.disconnect())
  await controller.connect(options,'TEST-SCALE-001');await assert.rejects(controller.read(),/SCALE_UNSTABLE/)
  assert.equal(controller.getState().status,'ready');assert.equal(controller.getState().reading,null)
  response=frame('S','S','0.25');await controller.read();assert.equal(controller.currentReading().net,'0.25')
  response='S +\r\n';await assert.rejects(controller.read(),/SCALE_OVERLOAD/);assert.equal(controller.getState().reading,null)
})
test('tare drift invalidates and closes the connection instead of adding a derived weight', async () => {
  const f=fixture({TA:({tareReads})=>frame('TA','A',tareReads===1?'0.125':'0.25')}),controller=createSicsScale({serial:f.access})
  await controller.connect(options,'TEST-SCALE-001');await assert.rejects(controller.read(),/SCALE_TARE_CHANGED/)
  assert.equal(controller.getState().reading,null);assert.equal(f.device.closes,1)
})
test('timeouts close old readers and late replies cannot become a new session reading', async t => {
  const first=fixture({S:undefined}),second=fixture({S:frame('S','S','0.5')}),access=new EventTarget();let choice=0
  access.requestPort=async()=>choice++?second.port:first.port
  const controller=createSicsScale({serial:access,timeoutMs:30});t.after(()=>controller.disconnect())
  await controller.connect(options,'TEST-SCALE-001');await assert.rejects(controller.read(),/SCALE_TIMEOUT/);await settled(controller)
  assert.equal(first.device.closes,1);assert.equal(controller.getState().reading,null)
  await controller.connect(options,'TEST-SCALE-001');first.reply(frame('S','S','999'));await controller.read()
  assert.equal(controller.currentReading().net,'0.5');assert.equal(second.device.commands.includes('@'),false)
})
test('scope cancellation during the chooser never opens or commands a late-selected port', async () => {
  const f=fixture();let choose;const access={requestPort:()=>new Promise(resolve=>{choose=resolve})}
  const controller=createSicsScale({serial:access});const connecting=controller.connect(options,'TEST-SCALE-001')
  await controller.disconnect();choose(f.port);await assert.rejects(connecting,/SCALE_DISCONNECTED/)
  assert.equal(f.device.opens,0);assert.deepEqual(f.device.commands,[]);assert.equal(controller.getState().reading,null)
})
test('freshness expiry clears confirmed preview state without touching the device', async t => {
  const f=fixture(),controller=createSicsScale({serial:f.access,staleMs:20});t.after(()=>controller.disconnect())
  await controller.connect(options,'TEST-SCALE-001');await controller.read();await delay(30)
  assert.equal(controller.getState().reading,null);assert.equal(controller.getState().error,'SCALE_READING_EXPIRED')
  assert.throws(()=>controller.currentReading(),/SCALE_READING_EXPIRED/);assert.deepEqual(f.device.commands,['I4','I0','TA','S','TA'])
})
test('disconnect interrupts a pending command and unsolicited frames are never cached', async () => {
  const f=fixture({S:undefined}),controller=createSicsScale({serial:f.access})
  await controller.connect(options,'TEST-SCALE-001');const reading=controller.read()
  // The first tare response must finish before the blocked stable response.
  for(let n=0;n<100&&!f.device.commands.includes('S');n++)await delay(1)
  await controller.disconnect();await assert.rejects(reading,/SCALE_DISCONNECTED/);assert.equal(controller.getState().reading,null)
  const g=fixture(),fresh=createSicsScale({serial:g.access});await fresh.connect(options,'TEST-SCALE-001');g.reply(frame('S','S','123'))
  for(let n=0;n<100&&fresh.getState().status==='ready';n++)await delay(1)
  await settled(fresh);assert.equal(fresh.getState().error,'SCALE_UNEXPECTED_RESPONSE');assert.equal(fresh.getState().reading,null)
})
test('malformed bytes and oversized capability lists fail closed with bounded buffers', async () => {
  for(const overrides of [{I4:'\u0000\r\n'},{I0:Array.from({length:513},()=>'I0 B 0 "S"\r\n')}]) {
    const f=fixture(overrides),controller=createSicsScale({serial:f.access})
    await assert.rejects(controller.connect(options,'TEST-SCALE-001'),/SCALE_(INVALID_FRAME|FRAME_LIMIT)/)
    assert.equal(controller.getState().reading,null);assert.equal(f.device.closes,1)
  }
})
test('unsupported browsers do not open a device; failed cleanup cannot start another connection', async () => {
  const unsupported=createSicsScale()
  await assert.rejects(unsupported.connect(options,'TEST-SCALE-001'),/SCALE_BROWSER_UNSUPPORTED/)
  assert.equal(unsupported.getState().status,'disconnected')
  const f=fixture(),controller=createSicsScale({serial:f.access});f.port.close=async()=>{throw Error('Synthetic close failure')}
  await controller.connect(options,'TEST-SCALE-001');await controller.disconnect()
  assert.equal(controller.getState().error,'SCALE_CLOSE_FAILED');assert.equal(controller.getState().canConnect,false)
  await assert.rejects(controller.connect(options,'TEST-SCALE-001'),/SCALE_BUSY/)
})
