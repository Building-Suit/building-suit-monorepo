import{test}from'@playwright/test'
import{exerciseDoctorAuthEntries}from'./auth-entry-journeys'
for(const ar of[false,true])test(`auth entries unconfigured ${ar?'AR mobile':'EN desktop'}: canonical navigation, aliases and public 404`,async({page,context})=>{
 test.setTimeout(120000);await page.setViewportSize({width:ar?390:1280,height:1000})
 await context.addCookies([{name:'building-suit-locale',value:ar?'ar':'en',url:'http://127.0.0.1:4336'}])
 await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
 await exerciseDoctorAuthEntries(page,false,ar)
})
