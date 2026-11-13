const cues={signedOut:'You are signed out',practiceTitle:'Your practice, on Android',scheduleTitle:'Your schedule, on Android',accessDenied:'Access unavailable'}
/** Only fixed public shell-cue booleans leave the private UI hierarchy. */
export function androidShellObservations(hierarchy){
 const result={available:typeof hierarchy==='string'&&hierarchy.length<=2097152,rawSignedOut:false,rawPracticeTitle:false,rawScheduleTitle:false,rawAccessDenied:false,accessibleSignedOut:false,accessiblePracticeTitle:false,accessibleScheduleTitle:false,accessibleAccessDenied:false}
 if(!result.available)return result
 const decoded=value=>value.replace(/&#(?:10|13);|&#x(?:0?[ad]);/gi,' ').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()
 const accessible=[...hierarchy.matchAll(/\b(?:text|content-desc)="([^"]*)"/g)].map(match=>decoded(match[1])).filter(Boolean).join(' ')
 for(const[key,value]of Object.entries(cues)){const suffix=key[0].toUpperCase()+key.slice(1);result['raw'+suffix]=hierarchy.includes(value);result['accessible'+suffix]=accessible.includes(value)}
 return result
}
