/** Controlled presentation models; no clinical authority, queries or recommendations. */
export interface BsClinicalSegmentFields {kind:string;start:string;end:string;timezone:string;interval:string;weekdays:string;times:string;instructions:string}
export interface BsClinicalPrescriptionFields {id:string;identity:string;name:string;strength:string;form:string;amount:string;unit:string;route:string;start:string;end:string;instructions:string;segments:BsClinicalSegmentFields[]}
export interface BsClinicalFields {
 patientId:string;note:string;reviewNote:string
 intake:{id:string;kind:string;knowledge:string;text:string;value:string;unit:string;source:string}[]
 prescriptions:BsClinicalPrescriptionFields[]
 orders:{id:string;kind:string;request:string;due:string;state:string;reason:string}[]
 results:{id:string;orderId:string;documentVersionId:string;stage:string;annotation:string}[]
}
export type BsClinicalCopy = Record<'title'|'description'|'notice'|'unavailable'|'retry'|'search'|'patient'|'status'|'date'|'open'|'create'|'edit'|'save'|'cancel'|'empty'|'close'|'start'|'finalize'|'amend'|'withdraw'|'print'|'export'|'release'|'revoke'|'confirm'|'reason'|'recipient'|'expires'|'note'|'reviewNote'|'intake'|'prescriptions'|'orders'|'results'|'history'|'releases'|'add'|'remove'|'kind'|'knowledge'|'text'|'value'|'unit'|'source'|'identity'|'name'|'strength'|'form'|'amount'|'route'|'startDate'|'endDate'|'instructions'|'segments'|'timezone'|'interval'|'weekdays'|'times'|'request'|'due'|'order'|'document'|'annotation'|'revision'|'actor'|'count'|'previous'|'next'|'upload'|'filename'|'download'|'syntheticIdentity'|'template'|'privateNotes'|'releaseNotice'|'exportNotice',string>
export interface BsClinicalChoices {intakeKinds:{value:string;label:string}[];knowledge:{value:string;label:string}[];sources:{value:string;label:string}[];segmentKinds:{value:string;label:string}[];orderKinds:{value:string;label:string}[];orderStates:{value:string;label:string}[];resultStages:{value:string;label:string}[]}
export interface BsClinicalWorkspaceView {
 title:string;description:string;scopeLabel:string;notice:string;loading:boolean;pending:boolean;error:string|null;recipientNotice:string|null;available:boolean
 page:number;total:number;scopeKey:string|null;canCreate:boolean;patients:{value:string;label:string}[]
 rows:{id:string;patient:string;status:string;date:string}[]
 detail:{id:string;patient:string;status:string;version:string;doctor:string;location:string;date:string;canEdit:boolean;canStart:boolean;canFinalize:boolean;canAmend:boolean;canWithdraw:boolean;canRelease:boolean;canExport:boolean}|null
 versions:{id:string;revision:string;status:string;actor:string;date:string;reason:string;canPrint:boolean}[]
 historyPage:number;historyTotal:number
 releases:{id:string;version:string;recipient:string;expires:string;status:string;canRevoke:boolean;href:string}[]
 recipients:{value:string;label:string}[];durations:{value:string;label:string}[]
 reading:{id:string;version:string;status:string;notes:{label:string;value:string}[];intake:{id:string;kind:string;knowledge:string;source:string;text:string;value:string;unit:string}[];prescriptions:{id:string;name:string;identity:string;strength:string;form:string;amount:string;route:string;schedule:string;instructions:string}[];orders:{id:string;kind:string;request:string;due:string;state:string;reason:string}[];results:{id:string;order:string;document:string;stage:string;annotation:string}[]}|null
 documents:{value:string;label:string;documentId:string;versionId:string}[]
 documentsHref:string;canUpload:boolean;documentsLoading:boolean;documentsPage:number;documentsTotal:number
 editor:{title:string;dirty:boolean;pending:boolean;error:string|null;disabled:boolean;creating:boolean}
 confirmation:{title:string;description:string;needsReason:boolean;needsRecipient:boolean;pending:boolean;error:string|null}
 upload:{pending:boolean;error:string|null}
}
export interface BsReleasedClinicalView {
 title:string;notice:string;loading:boolean;pending:boolean;available:boolean;unavailable:string;error:string|null
 metadata:{label:string;value:string}[]
 prescriptions:{id:string;name:string;identity:string;strength:string;form:string;amount:string;route:string;segments:string;instructions:string}[]
 results:{id:string;order:string;annotation:string}[]
 documents:{id:string;name:string}[]
}

/** Keep explicit ISO date ranges in their entered order inside RTL prose. */
export function clinicalDateRange(start: string, end: string): string { return `\u2066${start} – ${end}\u2069` }
