import{test,expect,type Browser,type BrowserContext}from'@playwright/test'
import{createClient}from'@supabase/supabase-js'
import{doctorPasswordStep}from'../helpers/password-step.mjs'
export{test,expect}
export interface OperationsActor{credentials:{email:string;password:string};scope:{practiceId:string;locationId:string;patientId:string}}
export interface OperationsFixture{origin:string;api:string;publicKey:string;day:string;owner:OperationsActor;other:OperationsActor;reception:OperationsActor;receptionStaff:OperationsActor;receptionRecords:{late:string;queue:string;missed:string;walkPatient:string;staffUser:string;membership:string;clinicalEncounter:string};receptionZone:string;receptionDay:string}
export function operationsFixture():OperationsFixture{if(process.env.DOCTOR_OPERATIONS_ACCEPTANCE!=='owned-actual-provider')throw new Error('Owned operations fixture required');const value=JSON.parse(process.env.DOCTOR_OPERATIONS_FIXTURE??'{}');if(value.origin!=='http://127.0.0.1:4342'||value.api!=='http://127.0.0.1:65321')throw new Error('Owned operations target rejected');return value}
const sessions=new Map<string,Awaited<ReturnType<BrowserContext['storageState']>>>()
export async function openOperations(browser:Browser,path:string,options:{ar?:boolean;dark?:boolean;width?:number;role?:'owner'|'other'|'reception'|'receptionStaff'}={}){
 const f=operationsFixture(),role=options.role??'owner',context=await browser.newContext({storageState:sessions.get(role),viewport:{width:options.width??1280,height:1000},colorScheme:options.dark?'dark':'light',locale:options.ar?'ar-EG':'en-US'})
 await context.route('**/*',r=>[f.origin,f.api].includes(new URL(r.request().url()).origin)?r.continue():r.abort());await context.addCookies([{name:'building-suit-locale',value:options.ar?'ar':'en',url:f.origin}]);await context.addInitScript(({dark})=>localStorage.setItem('building-suit.theme',dark?'dark':'light'),{dark:Boolean(options.dark)})
 const page=await context.newPage();page.setDefaultTimeout(20000)
 if(!sessions.has(role)){
  // Authenticate with English controls before selecting the target locale; no Auth artifacts are written.
  await context.addCookies([{name:'building-suit-locale',value:'en',url:f.origin}])
  try{await page.goto(f.origin+'/sign-in');await page.getByLabel(/^Email/).fill(f[role].credentials.email);await doctorPasswordStep(page);await page.getByLabel(/^Password/).fill(f[role].credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/sign-in');sessions.set(role,await context.storageState())}catch{await context.close();throw new Error('Synthetic operations browser sign-in failed')}
  await context.addCookies([{name:'building-suit-locale',value:options.ar?'ar':'en',url:f.origin}])
 }
 await page.goto(f.origin+path);return{context,page}
}
export async function operationsClient(role:'owner'|'other'|'reception'|'receptionStaff'='owner'){
 const f=operationsFixture(),client=createClient(f.api,f.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const login=await client.auth.signInWithPassword(f[role].credentials);if(login.error)throw new Error('Synthetic operations source sign-in failed');return client
}
