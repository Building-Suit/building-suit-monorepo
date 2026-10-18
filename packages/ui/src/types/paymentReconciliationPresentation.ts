export interface BsPaymentReconciliationFilters{from:string;to:string;status:string}
export interface BsPaymentReconciliationView{
 title:string;subtitle:string;notice:string;dateNotice:string;observed:string;loading:boolean;loadingLabel:string;error:string;denied:boolean;retry:string;empty:string
 fromLabel:string;toLabel:string;statusLabel:string;statuses:{value:string;label:string}[];applyLabel:string;totalsLabel:string;noticesLabel:string
 totalsColumns:{key:string;header:string}[];totals:{id:string;cells:Record<string,string>}[]
 columns:{key:string;header:string}[];rows:{id:string;cells:Record<string,string>;to:string}[];openLabel:string
 pagination:string;previousLabel:string;nextLabel:string;previousDisabled:boolean;nextDisabled:boolean;back:{to:string;label:string}
}
