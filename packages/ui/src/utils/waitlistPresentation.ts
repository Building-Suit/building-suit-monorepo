export type BsWaitlistAction='offer'|'accept'|'cancel'|'revoke_contact'|'expire'|'history'
export interface BsWaitlistFields{patientId:string;typeId:string;from:string;to:string;start:string;end:string;permission:boolean;source:string}
export interface BsWaitlistOfferFields{date:string;minute:number|null;minutes:string}
export interface BsWaitlistCopy{title:string;notice:string;create:string;patient:string;type:string;window:string;from:string;to:string;start:string;end:string;permission:string;source:string;permissionHint:string;state:string;search:string;offer:string;expires:string;history:string;actor:string;action:string;reason:string;version:string;blocked:string;save:string;cancel:string;close:string;retry:string;more:string;empty:string;previous:string;next:string;pages:string;holdMinutes:string;date:string;slot:string;timezone:string;checked:string}
export interface BsWaitlistRow{id:string;patient:string;type:string;window:string;state:string;permission:string;offer:string;expires:string;blocked:string;actions:{value:BsWaitlistAction;label:string}[]}
export interface BsWaitlistView{
 checkedAt:string;loading:boolean;pending:boolean;error:string|null;denied:string|null;canCreate:boolean;rows:BsWaitlistRow[];page:number;total:number;states:{value:string;label:string}[]
 patients:{value:string;label:string}[];types:{value:string;label:string}[]
 editor:{title:string;dirty:boolean;pending:boolean;error:string|null;disabled:boolean;patientsLoading:boolean;patientsError:string|null;typesLoading:boolean;typesError:string|null;minDate:string;maxDate:string}
 offerEditor:{title:string;summary:string;dirty:boolean;pending:boolean;error:string|null;disabled:boolean;loading:boolean;queryError:string|null;minDate:string;maxDate:string;timezone:string;slots:{value:number;label:string}[]}
 confirmation:{title:string;description:string;reasonRequired:boolean;dirty:boolean;pending:boolean;error:string|null;disabled:boolean}
 history:{title:string;loading:boolean;error:string|null;total:number;page:number;rows:{id:string;action:string;actor:string;at:string;reason:string;version:string}[]}
}
