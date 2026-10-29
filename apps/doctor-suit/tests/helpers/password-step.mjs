// Exercise the canonical shared email-first stage; older/default presentation remains compatible.
const protocolCallers = new WeakSet()
export async function doctorPasswordStep(page){
 if(new URL(page.url()).pathname!=='/sign-in')return
 if(new URL(page.url()).port==='4337'&&!protocolCallers.has(page)){
  // CI's owned protocol reverse-proxy simulation isolates unrelated callers;
  // repeated requests on this page retain the same server rate-limit scope.
  const bytes=crypto.getRandomValues(new Uint8Array(3))
  await page.setExtraHTTPHeaders({'x-forwarded-for':`127.${bytes[0]}.${bytes[1]}.${bytes[2]}`});protocolCallers.add(page)
 }
 const password=page.locator('input[type="password"]').first()
 if(await password.isVisible())return
 await page.locator('form button[type="submit"]').first().click()
 await password.waitFor({state:'visible'})
}
