import type { NavigationGroup,NavigationLink } from '@building-suit/contracts'
export interface DoctorNavigationAccess {
  capabilities: readonly string[]; portal?: 'doctor'|'secretary'; ownsPractice: boolean; hasCurrent: boolean; hasOptions: boolean; choosing: boolean
}
export interface DoctorNavigationLabels { workspace:string; patients:string; appointments:string; availability:string; audit:string; locations:string; practice:string; team:string; account:string;clinical?:string }
/** Presentation routes reflect existing role grants; this grants no authority. */
export function doctorWorkspaceNavigation(access:DoctorNavigationAccess,copy:DoctorNavigationLabels):{groups:NavigationGroup[];mobileLinks:NavigationLink[]} {
  const can=(...caps:string[])=>caps.some(cap=>access.capabilities.includes(cap))
  const ownerWithoutClinics=access.ownsPractice&&!access.hasOptions&&access.choosing
  const work:NavigationLink[]=[{to:'/workspace',label:copy.workspace,icon:'dashboard'},
    ...(can('appointments.read')?[{to:'/appointments',label:copy.appointments,icon:'invoice'}]:[]),
    ...(can('patients.read')?[{to:'/patients',label:copy.patients,icon:'user'}]:[]),
    ...(can('patients.read')&&copy.clinical?[{to:'/clinical',label:copy.clinical,icon:'reports'}]:[]),
    ...(can('availability.manage','appointments.read')?[{to:'/availability',label:copy.availability,icon:'repeat'}]:[])]
  const practice:NavigationLink[]=[
    ...(can('locations.read','locations.manage')||(!access.hasCurrent&&access.ownsPractice)?[{to:'/locations',label:copy.locations,icon:'store'}]:[]),
    ...(access.ownsPractice&&(!access.hasCurrent||access.portal==='doctor')?[{to:'/onboarding',label:copy.practice,icon:'settings'}]:[]),
    ...(access.portal==='doctor'||ownerWithoutClinics?[{to:'/team',label:copy.team,icon:'team'}]:[]),
    ...(can('audit.read')||ownerWithoutClinics?[{to:'/audit',label:copy.audit,icon:'reports'}]:[])]
  return {groups:[{key:'daily-work',label:copy.workspace,links:work},...(practice.length?[{key:'practice',label:copy.practice,links:practice}]:[]),{key:'account',label:copy.account,links:[{to:'/account',label:copy.account,icon:'user'}]}],
    mobileLinks:[...work.filter(item=>['/workspace','/appointments','/patients'].includes(item.to)),{to:'/account',label:copy.account,icon:'user'}]}
}
