import { createXPayCheckout } from '../_shared/xpay-handlers.mjs'
import { env, rpc, authenticate } from '../_shared/xpay-runtime.ts'
Deno.serve(createXPayCheckout({ env, rpc, authenticate }))
