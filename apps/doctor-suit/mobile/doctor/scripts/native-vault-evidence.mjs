// Only predeclared IDs and fixed status/issues leave private instrumentation
// output. Exception bodies, tokens, arbitrary class/test names never leave it.
export function nativeVaultEvidence(output,className,expected){
 const issues=new Set(),starts=new Map(),finishes=new Map(),records=expected.map(item=>({id:item.id,status:'unrun'}))
 if(typeof output!=='string')return{accepted:false,cases:records,issues:['report-unavailable']}
 let current={}
 for(const line of output.split(/\r?\n/)){
  const field=/^INSTRUMENTATION_STATUS: (class|test)=(.*)$/.exec(line)
  if(field){current[field[1]]=field[2];continue}
  const code=/^INSTRUMENTATION_STATUS_CODE: (-?\d+)$/.exec(line)
  if(!code)continue
  const item=expected.find(item=>item.method===current.test)
  if(!item||current.class!==className){issues.add('unexpected-population');current={};continue}
  if(Number(code[1])===1)starts.set(item.id,(starts.get(item.id)??0)+1)
  else{
   finishes.set(item.id,(finishes.get(item.id)??0)+1)
   records.find(row=>row.id===item.id).status=Number(code[1])===0?'passed':Number(code[1])===-3?'skipped':'failed'
  }
  current={}
 }
 for(const row of records)if(starts.get(row.id)!==1||finishes.get(row.id)!==1){
  issues.add('incomplete-or-duplicate-case')
  if(!finishes.has(row.id)&&starts.has(row.id))row.status='interrupted'
  else if(finishes.get(row.id)>1||row.status==='passed')row.status='failed'
 }
 if(!new RegExp(`OK \\(${expected.length} tests?\\)`).test(output)||!/^INSTRUMENTATION_CODE: -1\r?$/m.test(output))issues.add('runner-not-passed')
 if(records.some(row=>row.status!=='passed'))issues.add('case-not-passed')
 return{accepted:issues.size===0,cases:records,issues:[...issues].sort()}
}
