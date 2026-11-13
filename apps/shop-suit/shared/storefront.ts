import { validateWebsiteInquiry } from './publicWebsite.ts'
export type StorefrontQuery = { page: number; search: string; kind: 'all' | 'product' | 'service'; sort: 'featured' | 'name' | 'price_asc' | 'price_desc' }
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
export function parseStorefrontQuery(value: unknown): StorefrontQuery {
 if(!object(value)||Object.keys(value).some(key=>!['page','search','kind','sort'].includes(key))||!Number.isSafeInteger(value.page)||Number(value.page)<1||Number(value.page)>99999||typeof value.search!=='string'||Array.from(value.search).length>120||!['all','product','service'].includes(String(value.kind))||!['featured','name','price_asc','price_desc'].includes(String(value.sort)))throw Error('INVALID_STOREFRONT_QUERY')
 return{page:Number(value.page),search:value.search.trim(),kind:value.kind as StorefrontQuery['kind'],sort:value.sort as StorefrontQuery['sort']}
}
export function parseBasketRequest(value: unknown) {
 if(!object(value)||Object.keys(value).some(key=>!['name','contact','message','company','locale','lines'].includes(key))||typeof value.message!=='string'||Array.from(value.message).length>400||!Array.isArray(value.lines)||value.lines.length<1||value.lines.length>10)throw Error('INVALID_BASKET_REQUEST')
 const form=validateWebsiteInquiry({name:value.name,contact:value.contact,message:value.message.trim()||'Website basket request',company:value.company,locale:value.locale})
 const ids=new Set<string>()
 const lines=value.lines.map(line=>{
  if(!object(line)||Object.keys(line).length!==2||typeof line.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(line.id)||ids.has(line.id)||typeof line.quantity!=='number'||!Number.isFinite(line.quantity)||line.quantity<0.001||line.quantity>999||Math.abs(line.quantity*1000-Math.round(line.quantity*1000))>0.000001)throw Error('INVALID_BASKET_REQUEST')
  ids.add(line.id);return{id:line.id,quantity:line.quantity}
 })
 return{...form,message:value.message.trim(),lines}
}
