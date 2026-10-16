export type WebsiteInquiryStatus='new'|'read'|'closed'
export type PrivateWebsiteInquiry={id:string;name:string;contact:string;message:string;locale:'ar'|'en';status:WebsiteInquiryStatus;createdAt:string}
export type WebsiteInquiryInbox={items:PrivateWebsiteInquiry[];total:number;page:number;pageSize:number}
export function parseWebsiteInquiryInbox(value:unknown):WebsiteInquiryInbox {
 const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
 if(!record(value)||!Array.isArray(value.items)||value.items.length>20||!Number.isSafeInteger(value.total)||Number(value.total)<0||!Number.isSafeInteger(value.page)||Number(value.page)<1||value.pageSize!==20)throw Error('INVALID_WEBSITE_INBOX')
 for(const i of value.items)if(!record(i)||typeof i.id!=='string'||typeof i.name!=='string'||typeof i.contact!=='string'||typeof i.message!=='string'||typeof i.createdAt!=='string'||!Number.isFinite(Date.parse(i.createdAt))||typeof i.status!=='string'||!['new','read','closed'].includes(i.status))throw Error('INVALID_WEBSITE_INBOX')
 return value as WebsiteInquiryInbox
}
