import { createXPayReconciliation } from '../_shared/xpay-handlers.mjs'
import { env, rpc, authorizeServer } from '../_shared/xpay-runtime.ts'
Deno.serve(createXPayReconciliation({ env, rpc, authorizeServer }))
