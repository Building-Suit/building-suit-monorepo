import type { Page } from '@playwright/test'
// Synthetic transport only; actual delivery is a separate provider obligation.
export async function localRealtimeProtocol(page: Page) {
  await page.routeWebSocket('**/realtime/v1/websocket*',socket => socket.onMessage(raw => {
    const [joinRef,ref,topic,event,payload] = JSON.parse(String(raw))
    if(event==='phx_join') {
      const filters = (payload.config.postgres_changes || []).map((item: object,index: number) => ({ ...item,id: index+1 }))
      socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{ status: 'ok',response: { postgres_changes: filters } }]))
      socket.send(JSON.stringify([joinRef,null,topic,'system',{ extension: 'postgres_changes',status: 'ok',message: 'Synthetic subscription ready' }]))
    } else if(event==='phx_leave')socket.send(JSON.stringify([joinRef,ref,topic,'phx_reply',{ status: 'ok',response: {} }]))
    else if(event==='heartbeat')socket.send(JSON.stringify([null,ref,'phoenix','phx_reply',{ status: 'ok',response: {} }]))
  }))
}
