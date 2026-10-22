export default defineNuxtConfig({
  extends:['@building-suit/nuxt-layer'],
  ssr:false,
  devServer:{host:'127.0.0.1',port:3007},
  router:{options:{hashMode:true}},
  app:{head:{title:'Doctor Suit',meta:[{name:'robots',content:'noindex, nofollow'},{'http-equiv':'Content-Security-Policy',content:"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'"},{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'}]}},
  i18n:{baseUrl:'',locales:[{code:'en',name:'English',language:'en-US',file:'en.json'},{code:'ar',name:'العربية',language:'ar-EG',dir:'rtl',file:'ar.json'}]},
})
