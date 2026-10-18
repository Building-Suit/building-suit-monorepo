// Exercise the canonical shared email-first stage; older/default presentation remains compatible.
export async function doctorPasswordStep(page){
 if(new URL(page.url()).pathname!=='/sign-in')return
 const password=page.locator('input[type="password"]').first()
 if(await password.isVisible())return
 await page.locator('form button[type="submit"]').first().click()
 await password.waitFor({state:'visible'})
}
