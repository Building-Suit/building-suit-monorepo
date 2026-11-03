import { getHeader, setResponseStatus } from 'h3'
import { runtime, jsonBody, safe } from '../utils/hqRuntime'
import { executorActor } from '../utils/hqAuth'
import { parseAgentAction, projectState } from '../utils/hqDomain'
const string = { type: 'string', minLength: 1 }
function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]) {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } }
}
export default defineEventHandler(event => safe(async () => {
  const { config, store } = runtime(event)
  const actor = executorActor(getHeader(event, 'authorization'), config)
  const body = await jsonBody(event)
  if (body.method === 'notifications/initialized') { setResponseStatus(event,202);return '' }
  const result = (value: unknown) => ({ jsonrpc:'2.0', id:body.id, result:value })
  const failure = (code:number,message:string) => ({ jsonrpc:'2.0', id:body.id??null, error:{code,message} })
  if (body.jsonrpc !== '2.0' || !['string','number'].includes(typeof body.id)) return failure(-32600,'Invalid request')
  if (body.method === 'initialize') {
    return result({ protocolVersion:'2025-03-26', capabilities:{ tools:{} }, serverInfo:{ name:'building-suit-company-hq',version:'1.0.0' }, instructions:'Read the current authorized Company Brain before company work. Verify managed cloud. Only CEO replies to founder and delegates to HR. Proposals require founder approval. No paid APIs, new staff or fabricated progress. These tools record actual approved work; they do not run an AI model.' })
  }
  if (body.method === 'ping') return result({})
  const common = { requestKey:string }
  const available = [tool('hq_get_state','Read authorized HQ messages, tasks and activity. Does not establish a live Drive connection.',{},[])]
  if (actor.role === 'ceo') available.push(
    tool('hq_reply','Post an actual CEO reply to the founder after reading current authorized Brain. Never fabricate execution.',{...common,text:string,replyTo:string},['requestKey','text']),
    tool('hq_propose_task','Propose a zero-budget CEO plan for explicit founder approval. Does not start execution.',{...common,title:string,brief:string,acceptance:string,allowedActions:string},['requestKey','title','brief','acceptance','allowedActions']),
    tool('hq_delegate_task','Delegate a founder-approved queued CEO assignment to the existing HR Lead.',{...common,id:string,detail:string},['requestKey','id','detail']),
  )
  else available.push(tool('hq_report','Submit an actual internal report for an active HR assignment to CEO.',{...common,id:string,text:string},['requestKey','id','text']))
  available.push(tool('hq_update_task','Record real progress on an approved assignment. HR cannot complete/review itself; completion requires fresh review evidence.',{...common,id:string,status:{type:'string',enum:['queued','running','review','completed','blocked','failed']},detail:string,deliverable:string,...(actor.role==='ceo'?{reviewEvidence:string}:{})},['requestKey','id','status','detail']))
  if (body.method === 'tools/list') return result({tools:available})
  if (body.method !== 'tools/call') return failure(-32601,'Unknown method')
  const params=body.params as { name?:string;arguments?:unknown } | undefined
  if (!available.some(t=>t.name===params?.name)) return failure(-32602,'Unavailable tool for this identity')
  try {
    const value=params!.name==='hq_get_state' ? projectState(await store.read(),actor,config.remote?'supabase':'sqlite') : await store.execute(actor,parseAgentAction(params!.name,params!.arguments,actor))
    return result({content:[{type:'text',text:JSON.stringify(value)}]})
  } catch { return result({isError:true,content:[{type:'text',text:'HQ rejected this command. Check approval, identity, scope, status, input and review evidence. Retry with the same request key only for the same command.'}]}) }
}))
