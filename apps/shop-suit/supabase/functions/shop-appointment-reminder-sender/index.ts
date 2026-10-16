import {createAppointmentReminderSender} from '../_shared/appointment-reminders.mjs'
const env = (name: string) => Deno.env.get(name)
async function rpc(name: string, body: unknown) {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: {'content-type':'application/json',apikey:env('SUPABASE_SERVICE_ROLE_KEY') || '',authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`},
    body: JSON.stringify(body),
  })
  if (!response.ok) throw Error('reminder_rpc_failed')
  return response.json()
}
Deno.serve(createAppointmentReminderSender({env,rpc}))
