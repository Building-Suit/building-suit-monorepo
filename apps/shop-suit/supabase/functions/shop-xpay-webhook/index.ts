import { createXPayWebhook } from '../_shared/xpay-handlers.mjs'
import { env, rpc } from '../_shared/xpay-runtime.ts'
Deno.serve(createXPayWebhook({ env, rpc }))
