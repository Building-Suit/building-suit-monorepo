import {createHash} from 'node:crypto'
// Only trusted semantic values count. Clocks, lease attempts and narrative output do not.
export function incidentProgressFingerprint(value={}) {
 const normalized={evidence_revision:value.evidence_revision??null,classification:value.classification??null,
 source_hash:value.source_hash??null,changed_paths:[...(value.changed_paths??[])].sort(),
 regression:value.regression??null,regression_passed:value.regression_passed===true,
 runtime:value.runtime??null,recovery_transition:value.recovery_transition??null}
 return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
export function incidentBudget(invocations,now=Date.now(),extra=0) {
 const actual=invocations.filter(x=>x.launched_at)
 const first=actual.length?Math.min(...actual.map(x=>Date.parse(x.launched_at))):null
 let noProgress=0
 for(const item of actual){if(item.finished_at)noProgress=item.progressed===true?0:noProgress+1}
 const reserved=invocations.filter(x=>x.status==='reserved').length
 const reason=actual.length+reserved>=3+extra?'invocation_limit':first!==null&&now-first>=45*60_000?'wall_clock_limit':noProgress>=2?'no_progress_fuse':null
 return {allowed:reason===null,reason,actual_invocations:actual.length,reserved_invocations:reserved,
 no_progress_streak:noProgress,first_launched_at:first===null?null:new Date(first).toISOString(),
 remaining_ms:first===null?45*60_000:Math.max(0,45*60_000-(now-first))}
}
