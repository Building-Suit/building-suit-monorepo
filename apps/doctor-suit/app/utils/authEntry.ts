import{doctorPkceCallback,doctorReturnPath}from'./authConfiguration.ts'
/** Exact entry aliases only; never a wildcard redirect or an auth bypass. */
export function doctorAuthEntryRedirect(path:string,query:Record<string,unknown>){
 const aliases:Record<string,string>={'/auth/login':'/sign-in','/auth/signup':'/sign-up','/auth/forgot-password':'/recover','/auth/reset-password':'/recover'}
 const key=path.endsWith('/')?path.slice(0,-1):path,target=aliases[key]
 if(!target)return null
 const safe:Record<string,string>={}
 const next=query.next??query.returnTo
 if(next!==undefined)safe.next=doctorReturnPath(next)
 if(key==='/auth/reset-password'){
  const callback=doctorPkceCallback(query)
  if(callback){safe.code=callback.code;if(callback.flowId)safe.sb_flow_id=callback.flowId}
 }
 return{path:target,query:safe}
}
