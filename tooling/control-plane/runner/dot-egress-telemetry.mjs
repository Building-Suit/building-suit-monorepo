// Local, deterministic counters. No payloads, credentials or provider billing calls.
import {appendFileSync,mkdirSync,readFileSync,readdirSync,unlinkSync} from 'node:fs'
import path from 'node:path'
export function recordEgress(scope,values={},root=process.env.BS_CONTROL_REPOSITORY_ROOT,now=Date.now()){
 if(!root)return
 try{const dir=path.join(root,'.local/control-egress');mkdirSync(dir,{recursive:true,mode:0o700});const day=new Date(now).toISOString().slice(0,10)
 const allowed=['queries','bytes','connections','cache_hits','cache_misses','cycles','event_triggered','scheduled','heavy_evidence_loads','coalesced']
 const entry={at:now,scope};for(const k of allowed)if(Number.isFinite(values[k])&&values[k]>=0)entry[k]=values[k]
 appendFileSync(path.join(dir,day+'.jsonl'),JSON.stringify(entry)+'\n',{mode:0o600})
 for(const file of readdirSync(dir))if(/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(file)&&Date.parse(file.slice(0,10))+3*86400000<now)unlinkSync(path.join(dir,file))
 }catch{/* Counter failure must never block recovery. */}
}
export function readEgress(root=process.env.BS_CONTROL_REPOSITORY_ROOT,now=Date.now()){
 const result={last_hour:{},last_24h:{}}
 if(!root)return result
 for(const age of [0,86400000]){let data;try{data=readFileSync(path.join(root,'.local/control-egress',new Date(now-age).toISOString().slice(0,10)+'.jsonl'),'utf8')}catch{continue}
 for(const line of data.split('\n')){let row;try{row=JSON.parse(line)}catch{continue}if(row.at>now||row.at<now-86400000)continue
 for(const [name,duration] of [['last_hour',3600000],['last_24h',86400000]])if(row.at>=now-duration){const target=result[name][row.scope]??={};for(const [key,value] of Object.entries(row))if(key!=='at'&&key!=='scope'&&typeof value==='number')target[key]=(target[key]??0)+value}
 }}return result
}
