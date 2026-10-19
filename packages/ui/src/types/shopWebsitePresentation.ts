import type {LandingContent} from '@building-suit/contracts'
import type {BsLandingPreview,BsLandingPricing,BsLandingChangelog} from './landingPresentation'
export type BsWebsiteInquiryForm={name:string;contact:string;message:string;company:string}
export interface BsWebsiteStoreItem { id:string;kind:'product'|'service';kindLabel:string;name:string;description:string;image:string|null;price:string;bookingHref?:string;bookingLabel?:string;quantity:number }
export type BsShopWebsiteView={
 bookingLink?:{href:string;label:string}
 portalLink:{href:string;label:string}
 name:string;description:string;logo:string;locale:'ar'|'en';languageLinks:Array<{locale:string;label:string;href:string}>
 contacts:Array<{kind:string;label:string;href:string}>;openingHours:string;locations:Array<{name:string;address:string;mapHref:string}>
 items:BsWebsiteStoreItem[];featured:BsWebsiteStoreItem[];page:number;total:number;previous:string|null;next:string|null
 discovery:{search:string;kind:string;sort:string;filters:{value:string;label:string;count?:number}[];sorts:{value:string;label:string}[];loading:boolean;refreshing:boolean;failed:boolean;range:string;filtered:boolean}
 basket:{lines:Array<BsWebsiteStoreItem&{quantity:number;lineTotal:string}>;count:number;totals:{currency:string;label:string}[];pending:boolean;error:string;success:string;feedback:string}
 pending:boolean;error:string;success:string
 copy:Record<'catalog'|'locations'|'hours'|'contact'|'inquiry'|'inquiryHelp'|'name'|'replyContact'|'message'|'send'|'company'|'previous'|'next'|'language'|'empty'|'navigation'|'browse'|'products'|'services'|'visit'|'details'|'add'|'added'|'basket'|'basketEmpty'|'basketHelp'|'basketSend'|'basketSuccess'|'basketNotes'|'quantity'|'increase'|'decrease'|'remove'|'total'|'priceHelp'|'search'|'sort'|'clear'|'retry'|'loading'|'catalogError'|'close'|'imagePlaceholder'|'discover'|'bookingTitle'|'bookingBody'|'portalTitle'|'portalBody'|'directions'|'about'|'requestLimit'|'poweredBy',string>
}
export type BsShopPublicEntryView={kind:'website';website:BsShopWebsiteView}|{kind:'marketing';content:LandingContent;preview:BsLandingPreview;pricing:BsLandingPricing;changelog:BsLandingChangelog}
