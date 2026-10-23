// Keep activity/component names inside the owned emulator reader. Receipts
// carry only whether one current foreground is known and whether it is ours.
export function androidForeground(output){
 if(typeof output!=='string')return{known:false,syntheticForeground:false}
 const top=[],resumed=[]
 for(const line of output.split(/\r?\n/)){
  const row=/^\s*(topResumedActivity|mResumedActivity)\s*[:=]\s*ActivityRecord\{[^\n]*?\s([A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+)(?:\s|\})/.exec(line)
  if(row)(row[1]==='topResumedActivity'?top:resumed).push(row[2])
 }
 const current=new Set(top.length?top:resumed)
 return{known:current.size===1,syntheticForeground:current.size===1&&[...current][0].startsWith('com.buildingsuit.doctor.synthetic/')}
}
