export type BsWorklistAction='start'|'complete'|'reassign'|'cancel'|'history'
export interface BsWorklistFields{kind:string;patientId:string;assignee:string;day:string;time:string}
export interface BsWorklistActionFields{assignee:string;reason:string}
export interface BsWorklistCopy{title:string;notice:string;create:string;kind:string;patient:string;patientHint:string;assignee:string;day:string;time:string;due:string;timezone:string;state:string;action:string;history:string;actor:string;reason:string;version:string;previousAssignee:string;nextAssignee:string;save:string;close:string;reload:string;empty:string;mine:string;overdue:string;blocked:string;checked:string;previous:string;next:string;pages:string;more:string}
export interface BsWorklistView{
 loading:boolean;pending:boolean;error:string|null;denied:string|null;checkedAt:string;canCreate:boolean;page:number;total:number;states:{value:string;label:string}[];kinds:{value:string;label:string}[];reasons:{value:string;label:string}[];assignees:{value:string;label:string}[];patients:{value:string;label:string}[]
 rows:{id:string;kind:string;patient:string;assignee:string;due:string;state:string;overdue:boolean;blocked:boolean;actions:{value:BsWorklistAction;label:string}[]}[]
 editor:{title:string;dirty:boolean;pending:boolean;error:string|null;disabled:boolean;canReadPatients:boolean;optionsLoading:boolean;optionsError:string|null;patientsLoading:boolean;patientsError:string|null;minDate:string;maxDate:string;timezone:string}
 confirmation:{title:string;summary:string;dirty:boolean;pending:boolean;error:string|null;disabled:boolean;reassign:boolean;optionsLoading:boolean;optionsError:string|null}
 history:{loading:boolean;error:string|null;page:number;total:number;rows:{id:string;action:string;actor:string;version:string;reason:string;previousAssignee:string;assignee:string;at:string}[]}
}
