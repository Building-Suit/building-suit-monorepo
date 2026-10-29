export interface BsPracticeReportFilters { location:string;from:string;until:string;status:string;metric:string;group:string }
export interface BsPracticeReportCopy { title:string;notice:string;basis:string;from:string;until:string;status:string;metric:string;group:string;clinic:string;allClinics:string;allCurrencies:string;apply:string;refresh:string;loading:string;error:string;denied:string;empty:string;sources:string;source:string;amount:string;recorded:string;issued:string;state:string;previous:string;next:string;close:string;sourceTitle:string;sourceError:string;saas:string;billing:string;total:string;observed:string;clinicPages:string }
export interface BsPracticeReportView {
 billingTo:string;saasTo:string;loading:boolean;error:boolean;denied:boolean;ready:boolean;observed:string;page:string;previous:boolean;next:boolean
 clinics:{label:string;value:string}[];clinicLoading:boolean;clinicError:boolean;clinicPrevious:boolean;clinicNext:boolean
 statuses:{label:string;value:string}[];metrics:{label:string;value:string}[];groups:{label:string;value:string}[]
 totals:{id:string;label:string;value:string;to:string}[]
 rows:{id:string;source:string;amount:string;recorded:string;issued:string;state:string;to:string}[]
 source:{visible:boolean;loading:boolean;error:boolean;items:{term:string;value:string}[]}
}
