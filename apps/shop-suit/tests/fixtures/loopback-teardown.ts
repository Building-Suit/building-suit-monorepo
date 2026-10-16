import type {Page,TestInfo} from '@playwright/test'

/** Keep late tenant prefetches off the network while draining active handlers. */
export async function drainLoopbackRoutes(page:Page,info:TestInfo,pattern:string|RegExp){
 await page.context().route(pattern,async route=>{
  try{await route.abort()}
  catch(error){
   // Context disposal can finish an intercepted request before abort resolves.
   // It is already handled, so it cannot fall through to the external network.
   // Preserve every other transport error and every test assertion unchanged.
   if(!(error instanceof Error)||!error.message.includes('Route is already handled!'))throw error
  }
 })
 await page.unrouteAll({behavior:info.status===info.expectedStatus?'wait':'ignoreErrors'})
}
