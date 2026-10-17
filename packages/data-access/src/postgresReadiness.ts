/** Bridge provider channel admission and its separate Postgres subscription-ready signal. */
export function createPostgresReadinessBarrier(
  system: (callback: (payload: unknown) => void) => unknown,
  status: (callback: (value: string) => void) => unknown,
  timeoutMs = 15000,
) {
  let dispose = () => {};let subscribed = false
  return {
    subscribe(callback: (value: string) => void) {
      if(subscribed)throw new Error('Postgres readiness barrier already subscribed')
      subscribed = true
      let joined = false;let ready = false;let active = false;let removed = false
      let timer: ReturnType<typeof setTimeout>|undefined
      const cancel = () => { if(timer!==undefined)clearTimeout(timer);timer = undefined }
      const arm = () => { if(timer!==undefined || removed)return;timer = setTimeout(() => { timer = undefined;joined = ready = active = false;if(!removed)callback('TIMED_OUT') },timeoutMs) }
      const reconcile = () => { if(!removed && joined && ready && !active) { cancel();active = true;callback('SUBSCRIBED') } }
      dispose = () => { removed = true;cancel() }
      arm()
      system(payload => {
        if(removed || !payload || typeof payload!=='object' || !('extension' in payload) || payload.extension!=='postgres_changes' || !('status' in payload))return
        if(payload.status==='ok') { ready = true;reconcile() }
        else if(payload.status==='error') { joined = ready = active = false;cancel();callback('CHANNEL_ERROR') }
      })
      status(value => {
        if(removed)return
        if(value==='SUBSCRIBED') { joined = true;arm();reconcile() }
        else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(value)) { joined = ready = active = false;cancel();callback(value) }
      })
    },
    dispose() { dispose() },
  }
}
