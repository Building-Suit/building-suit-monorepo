import {showcase} from './public-website.mjs'
import {createBookingFixture} from './public-booking.mjs'
export const launchCodes={'alpha-tools':'0123ABCDEFGH','beta-tools':'2345BCDEFGHJ'}
export function createWebsiteLaunchFixture(){
 const booking=createBookingFixture(),states=new Map([['alpha-tools','published'],['beta-tools','published']]),inquiries=[]
 const canonical=slug=>slug==='alpha-alias'?'alpha-tools':slug
 function control(args){if(args.reset){booking.rpc('control',{});states.set('alpha-tools','published');states.set('beta-tools','published');inquiries.length=0}if(args.slug&&args.state)states.set(args.slug,args.state);return{ok:true}}
 function rpc(name,args,headers={}){
  const slug=canonical(args.p_slug)
  if(name==='shop_website_host_resolve')return states.get(slug)==='published'?{canonicalSlug:slug,isAlias:slug!==args.p_slug}:null
  if(name==='shop_website_showcase')return states.get(slug)==='published'?{...showcase(slug),privateCost:'LEAK-COST',fifo:'LEAK-FIFO',supplier:'LEAK-SUPPLIER',internalNotes:'LEAK-INTERNAL'}:null
  if(name==='shop_website_inquiry_submit'){
   if(states.get(slug)!=='published')return{ok:false}
   inquiries.push({slug,name:args.p_name,contact:args.p_contact,message:args.p_message});return{ok:true}
  }
  if(name==='appointment_access_session_revoke')return booking.rpc(name,{...args,p_slug:slug})
  if(states.get(slug)!=='published')return{ok:false,authenticated:false}
  let input={...args,p_slug:slug}
  if(name==='appointment_access_verify')input.p_code=args.p_code===launchCodes[slug]?'0123ABCDEFGH':'BAD'
  const result=booking.rpc(name,input)
  if(name==='appointment_booking_command'&&result.ok&&result.code)result.code=launchCodes[slug]
  // No incoming product auth context may reach the anonymous public adapter.
  if(headers.cookie||headers.authorization)throw Error('PUBLIC_CONTEXT_LEAK')
  return result
 }
 return{rpc,control,inquiries}
}
