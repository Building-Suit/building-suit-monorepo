import type {ClinicalStatus,ClinicalVersion} from '@building-suit/contracts'
import type {BsClinicalFields,BsClinicalWorkspaceView} from '@building-suit/ui/utils/clinicalPresentation'
import {clinicalDateRange} from '@building-suit/ui/utils/clinicalPresentation'
import en from '../../i18n/locales/en.json'
import ar from '../../i18n/locales/ar.json'
export const nativeClinicalCopy=(arabic:boolean)=>(arabic?ar:en).clinical
export const nativeClinicalChoices=(arabic:boolean)=>(arabic?ar:en).clinicalChoices
export const nativeClinicalStateCopy=(arabic:boolean)=>(arabic?ar:en).clinicalState
export const nativePrescriptionReviewCopy=(arabic:boolean)=>(arabic?ar:en).prescriptionReview
export const nativeClinicalStatus=(status:ClinicalStatus|'active'|'superseded',arabic:boolean)=>(arabic?ar:en).clinicalStatuses[status]
export const emptyNativeClinicalFields=():BsClinicalFields=>({patientId:'',note:'',reviewNote:'',intake:[],prescriptions:[],orders:[],results:[]})
export function nativeClinicalReading(version:ClinicalVersion,arabic:boolean):BsClinicalWorkspaceView['reading']{
 const copy=nativeClinicalCopy(arabic),snapshot=version.snapshot
 return{id:version.id,version:String(version.revision),status:nativeClinicalStatus(['active','superseded','withdrawn'].includes(version.version_status)?version.version_status:version.kind,arabic),
  notes:snapshot.note.sections.map(section=>({label:section.key==='entered_note'?copy.note:copy.reviewNote,value:section.text})),
  intake:snapshot.intake.map(item=>({...item})),
  prescriptions:snapshot.prescriptions.map(item=>({id:item.id,name:item.medicine.label,identity:item.medicine.identity,strength:item.medicine.strength,form:item.medicine.form,amount:`${item.dose.amount} ${item.dose.unit}`,route:item.dose.route,schedule:clinicalDateRange(item.start_date,item.end_date)+'\n'+item.segments.map(segment=>`${clinicalDateRange(segment.start_date,segment.end_date)} · ${segment.timezone} · ${nativeClinicalChoices(arabic).segmentKinds.find(choice=>choice.value===segment.kind)?.label??segment.kind} · ${copy.interval}: ${segment.interval_minutes??''} · ${copy.weekdays}: ${segment.weekdays.join(', ')} · ${copy.times}: ${segment.times.join(', ')} · ${segment.instructions}`).join('\n'),instructions:item.instructions})),
  orders:snapshot.orders.map(item=>({id:item.id,kind:item.kind,request:item.request,due:item.due_at??'',state:item.state,reason:item.reason})),
  results:snapshot.results.map(item=>({id:item.id,order:item.order_id,document:item.document_version_id??'',stage:item.stage,annotation:item.annotation})),
 }
}
