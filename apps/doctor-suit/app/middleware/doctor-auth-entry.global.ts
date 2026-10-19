import{doctorAuthEntryRedirect}from'../utils/authEntry'
export default defineNuxtRouteMiddleware(to=>{
 const target=doctorAuthEntryRedirect(to.path,to.query)
 if(target)return navigateTo(target,{redirectCode:302,replace:true})
})
