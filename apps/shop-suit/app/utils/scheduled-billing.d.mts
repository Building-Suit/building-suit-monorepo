import type { PlanResourceKey } from '../types/plans'
export type ScheduledChange = {id:string;state:'scheduled'|'cancelled'|'completed';catalogTermsId:string|null;privateOfferId:string|null;needsOfferLink:boolean;planName:string;billingInterval:'monthly'|'annual';currency:'EGP';indicativePriceAmount:number;effectiveAt:string;createdAt:string;available:boolean;canPayNow:boolean;canCancel:boolean;blockers:{resource:PlanResourceKey;used:number;limit:number;excess:number}[]}
export function parseScheduledChange(value:unknown):ScheduledChange|null
export function parseChangePreview(value:unknown):{timing:'now'|'term_end';effectiveAt:string|null;scheduled:ScheduledChange|null}
