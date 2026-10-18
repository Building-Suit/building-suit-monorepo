export type BsManualPaymentLabel='title'|'description'|'notice'|'loading'|'retry'|'empty'|'account'|'review'|'customer'|'plan'|'interval'|'monthly'|'yearly'|'terms'|'accept'|'prepare'|'unconfigured'|'instructions'|'reference'|'at'|'receipt'|'receiptHelp'|'submit'|'claimOnly'|'upload'|'uploadPending'|'id'|'amount'|'status'|'open'|'history'|'reason'|'receivedReference'|'receivedAmount'|'receivedCurrency'|'receivedAt'|'verification'|'independent'|'underReview'|'reject'|'verifyFunds'|'activate'|'activationNotice'|'previous'|'next'|'uncertain'|'retryOperation'|'cancel'|'details'|'skipReceipt'
export interface BsManualPaymentValues{plan:string;interval:string;accepted:boolean;reference:string;at:string;file:File|null;reason:string;receivedReference:string;receivedAmount:string;receivedCurrency:string;receivedAt:string;verification:string;independent:boolean}
export interface BsManualPaymentRow{id:string;reference:string;amount:string;status:string}
export interface BsManualPaymentView{
 copy:Record<BsManualPaymentLabel,string>;review:boolean;canReview:boolean;loading:boolean;pending:boolean;ready:boolean;error:string|null;uncertain:boolean
 plans:{value:string;label:string}[];document:string|null;terms:{label:string;value:string}[];canPrepare:boolean;configured:boolean
 instructions:{label:string;value:string}[];canSubmit:boolean;uploadPending:boolean;canUpload:boolean
 rows:BsManualPaymentRow[];selected:{id:string;fields:{label:string;value:string}[];history:{title:string;description:string}[];evidence:{id:string;label:string}[];canReview:boolean;canVerify:boolean;canActivate:boolean}|null
 page:number;total:number
}
