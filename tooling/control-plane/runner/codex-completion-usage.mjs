// Only actual model completion events are usage evidence. Missing counts stay
// null; scheduler claims, transport failures and healthy monitoring add none.
export function completionUsage(event,context={},duration=null){
 if(event?.type!=='turn.completed'||!event.usage)return null
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:null
 return {model:context.model??null,reasoning_effort:context.reasoning_effort??null,task_id:context.task_id??null,run_id:context.run_id??null,execution_id:context.execution_id??null,attempt:context.attempt??null,incident_id:context.incident_id??null,input_tokens:count(event.usage.input_tokens),cached_input_tokens:count(event.usage.cached_input_tokens),output_tokens:count(event.usage.output_tokens),reasoning_tokens:count(event.usage.reasoning_tokens),duration_ms:count(duration)}
}
