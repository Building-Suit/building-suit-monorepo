// Fixed categories only. RPC error messages/details and account values never
// enter logs; an unrecognized code remains unrecognized.
const codes=new Set(['42501','57014','53300','PGRST116','PGRST301','PGRST302'])
export function doctorAccountReadObservation(result){
 const status=result?.status
 return{
  status:Number.isInteger(status)&&(status===0||(status>=100&&status<=599))?status:null,
  errorPresent:Boolean(result?.error),
  errorCode:result?.error?codes.has(result.error.code)?result.error.code:'other':null,
  contactAllowed:typeof result?.data?.can_change_contact==='boolean'?result.data.can_change_contact:null,
 }
}
export function doctorAccountAssertion(error){
 if(error instanceof Error&&error.message==='Real account settings read rejected')return'account-read-rejected'
 if(error instanceof Error&&error.message==='Actual account stage timed out')return'account-readiness-timeout'
 return'other'
}
