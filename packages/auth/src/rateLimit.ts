/** Bounded per-process request limit. Product adapters own keys and deployment-wide enforcement. */
export function createRequestRateLimit(limit=5,windowMs=600000,maxKeys=1000) {
 const windows=new Map<string,{count:number;until:number}>()
 return (key:string,now=Date.now())=>{
  for(const [k,v]of windows)if(v.until<=now)windows.delete(k)
  const current=windows.get(key)
  if(current){if(current.count>=limit)return false;current.count++;return true}
  if(windows.size>=maxKeys)return false
  windows.set(key,{count:1,until:now+windowMs});return true
 }
}
