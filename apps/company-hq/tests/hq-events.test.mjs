/** Mocked private transport: no HTTP, hosted writes or inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { randomUUID } from 'node:crypto'

registerHooks({ resolve(specifier,context,nextResolve) {
  if (context.parentURL?.endsWith('/server/utils/hqEvents.ts')) {
    if (specifier === 'h3') return {url:'data:text/javascript,'+encodeURIComponent(`export const createError = value => Object.assign(new Error(value.statusMessage), value); export function setResponseHeaders(event,headers) { event.node.res.headers=headers }`),shortCircuit:true}
    if (specifier === './hqAccess.ts') return {url:'data:text/javascript,'+encodeURIComponent(`export async function requireHqFounder() { return globalThis.__hqEventsFixture.session }; export function hqRealtimeUrl() { return 'wss://private.invalid' }; export async function hqRpc(config,token,name) { globalThis.__hqEventsFixture.calls.push(name); return globalThis.__hqEventsFixture.authorized }`),shortCircuit:true}
  }
  return nextResolve(specifier,context)
}})
const {streamHqEvents}=await import('../server/utils/hqEvents.ts')
const tick=async(t,ms)=>{t.mock.timers.tick(ms);await Promise.resolve();await Promise.resolve();await Promise.resolve()}
class Socket extends EventTarget {
 static OPEN=1
 readyState=1;bufferedAmount=0;sent=[]
 constructor(){super();globalThis.__hqEventsFixture.socket=this}
 send(value){this.sent.push(JSON.parse(value))}
 receive(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))}
 close(){this.readyState=3}
}
class Response extends EventEmitter {
 destroyed=false;writableEnded=false;writableLength=0;frames=[]
 write(frame){this.frames.push(frame);return true}
 flushHeaders(){}
 end(){this.writableEnded=true}
 destroy(){this.destroyed=true}
}
function frame(event,payload,ref='x',topic='realtime:hq-live'){return{topic,event,payload,ref}}
async function open(t){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']})
 const userId=randomUUID(),payload=Buffer.from(JSON.stringify({sub:userId,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
 const fixture={session:{accessToken:'fixture.'+payload+'.fixture',user:{id:userId}},calls:[],authorized:true}
 globalThis.__hqEventsFixture=fixture
 const original=globalThis.WebSocket;globalThis.WebSocket=Socket
 const response=new Response(),request=new EventEmitter();request.aborted=false
 const promise=streamHqEvents({node:{req:request,res:response}},{hqSupabaseUrl:'https://dpruoncalmwicrqhqelu.supabase.co'})
 await Promise.resolve();await Promise.resolve();const socket=fixture.socket
 socket.dispatchEvent(new Event('open'))
 socket.receive(frame('phx_reply',{status:'ok'},'1'))
 socket.receive(frame('system',{status:'ok',extension:'system',message:'Replication connection established'}))
 await tick(t,50)
 t.after(async()=>{response.emit('close');await promise;globalThis.WebSocket=original;delete globalThis.__hqEventsFixture})
 return{fixture,response,socket}
}

test('protocol heartbeats and actual presence observations never become company or agent invalidations',async t=>{
 const {fixture,response,socket}=await open(t)
 assert.equal(fixture.calls.length,1);assert.equal(response.frames.filter(f=>f.startsWith('event: ready')).length,1)
 const initial=response.frames.length
 for(let index=0;index<4;index++){
  await tick(t,20_000)
  const heartbeat=socket.sent.at(-1);assert.equal(heartbeat.event,'heartbeat')
  socket.receive(frame('phx_reply',{status:'ok'},heartbeat.ref,'phoenix'))
 }
 assert.equal(fixture.calls.length,1);assert.ok(response.frames.slice(initial).every(f=>f===': keepalive\n\n'))
 const observation={observedAt:new Date().toISOString(),agentId:null,taskId:null}
 socket.receive(frame('broadcast',{event:'presence',payload:observation}));await tick(t,50)
 assert.equal(fixture.calls.length,2);assert.ok(response.frames.some(f=>f===`event: presence\ndata: ${JSON.stringify(observation)}\n\n`))
 assert.equal(response.frames.filter(f=>/^event: (agents|company)\n/.test(f)).length,0)
 socket.receive(frame('broadcast',{event:'invalidate',payload:{kind:'agents'}}));await tick(t,50)
 assert.equal(response.frames.filter(f=>f==='event: agents\ndata: {}\n\n').length,1)
 assert.equal(response.frames.filter(f=>f.startsWith('event: company')).length,0)
})

test('presence is bounded and authority is revalidated before delivery',async t=>{
 const {fixture,response,socket}=await open(t)
 const initialCalls=fixture.calls.length
 for(const payload of [{observedAt:'invalid',agentId:null,taskId:null},{observedAt:new Date().toISOString(),agentId:'AG-CEO-001',taskId:null},{observedAt:new Date(Date.now()-151_000).toISOString(),agentId:null,taskId:null}])socket.receive(frame('broadcast',{event:'presence',payload}))
 await tick(t,50);assert.equal(fixture.calls.length,initialCalls);assert.equal(response.frames.filter(f=>f.startsWith('event: presence')).length,0)
 fixture.authorized=false
 socket.receive(frame('broadcast',{event:'presence',payload:{observedAt:new Date().toISOString(),agentId:'AG-CEO-001',taskId:randomUUID()}}));await tick(t,50)
 assert.equal(response.frames.filter(f=>f.startsWith('event: presence')).length,0);assert.ok(response.frames.includes('event: access\ndata: {}\n\n'));assert.equal(response.writableEnded,true)
})
