import type {LandingContent} from '@building-suit/contracts'
import type {BsLandingPreview,BsLandingPricing,BsLandingChangelog} from './landingPresentation'
export type BsWebsiteInquiryForm={name:string;contact:string;message:string;company:string}
export type BsShopWebsiteView={
 bookingLink?:{href:string;label:string}
 portalLink:{href:string;label:string};
 name:string;description:string;logo:string;locale:'ar'|'en';languageLinks:Array<{locale:string;label:string;href:string}>
 contacts:Array<{kind:string;label:string;href:string}>;openingHours:string;locations:Array<{name:string;address:string}>
 items:Array<{id:string;kind:string;name:string;description:string;image:string|null;price:string}>;page:number;total:number;previous:string|null;next:string|null
 pending:boolean;error:string;success:string
 copy:Record<'catalog'|'locations'|'hours'|'contact'|'inquiry'|'inquiryHelp'|'name'|'replyContact'|'message'|'send'|'company'|'previous'|'next'|'language'|'empty',string>
}
export type BsShopPublicEntryView={kind:'website';website:BsShopWebsiteView}|{kind:'marketing';content:LandingContent;preview:BsLandingPreview;pricing:BsLandingPricing;changelog:BsLandingChangelog}
