// BS00 retries transport/control-DB RPC failures; task recovery remains in SQL.
export function withDurableTransportRecovery(workflow) {
  const copy = structuredClone(workflow)
  const ssh = copy.nodes.find(node => node.type === 'n8n-nodes-base.ssh')
  const parser = copy.nodes.find(node => node.name === 'Parse Runner Result')
  if (!ssh || !parser) throw new Error('runner_transport_nodes_missing')
  ssh.retryOnFail = true
  ssh.maxTries = 3
  ssh.waitBetweenTries = 1000
  const appendix = `
const row = $input.first().json;
const errorText = String(row.payload?.error ?? row.payload?.reason ?? row.ssh_error ?? row.stderr ?? '');
const explicit = row.payload?.classification?.failure_class ?? row.payload?.recovery?.failure_class;
const authorizationError = !explicit && /permission denied|authentication failed|invalid private key|host key verification failed/i.test(errorText);
const knownTransient = /connection refused|connection reset|timed out|timeout|network is unreachable|control_database_connectivity|control_database_connectivity_unavailable|temporary failure/i.test(errorText);
const databaseWait = row.payload?.reason === 'control_database_connectivity_unavailable' && explicit === 'external-wait';
const transportRetry = databaseWait || !authorizationError && (explicit ? ['transient-infrastructure','verification-infrastructure'].includes(explicit) : knownTransient);
return [{json:{...row,transport_retry:transportRetry,transport_failure_class:explicit ?? (authorizationError?'operator-wait':transportRetry?'transient-infrastructure':null)}}];`
  // Keep the existing parser intact as a separate Code node. This consumes its
  // structured result, rather than searching a serialized task payload.
  copy.nodes.push({id:'bs00-recovery-classify',name:'Classify RPC Recovery',type:'n8n-nodes-base.code',typeVersion:2,position:[700,0],parameters:{jsCode:appendix}},
    {id:'bs00-recovery-route',name:'RPC Recovery Required?',type:'n8n-nodes-base.if',typeVersion:2.3,position:[920,0],parameters:{conditions:{conditions:[{leftValue:'={{ $json.transport_retry }}',operator:{type:'boolean',operation:'true',singleValue:true}}]}}},
    {id:'bs00-recovery-wait',name:'Persist RPC Backoff',type:'n8n-nodes-base.wait',typeVersion:1.1,position:[1140,-120],parameters:{resume:'timeInterval',amount:30,unit:'seconds'}})
  copy.connections[parser.name]={main:[[{node:'Classify RPC Recovery',type:'main',index:0}]]}
  copy.connections['Classify RPC Recovery']={main:[[{node:'RPC Recovery Required?',type:'main',index:0}]]}
  copy.connections['RPC Recovery Required?']={main:[[{node:'Persist RPC Backoff',type:'main',index:0}],[]]}
  copy.connections['Persist RPC Backoff']={main:[[{node:ssh.name,type:'main',index:0}]]}
  // False branch is a terminal pass-through node so the caller receives the
  // parsed structured response as the workflow's final result.
  copy.nodes.push({id:'bs00-recovery-return',name:'Return Runner Response',type:'n8n-nodes-base.code',typeVersion:2,position:[1140,100],parameters:{jsCode:'return $input.all();'}})
  copy.connections['RPC Recovery Required?'].main[1]=[{node:'Return Runner Response',type:'main',index:0}]
  copy.active=false
  return copy
}
