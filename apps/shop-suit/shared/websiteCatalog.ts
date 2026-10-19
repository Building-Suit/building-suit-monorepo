export type WebsiteCatalogKind = 'product' | 'service'
export type WebsiteCatalogEntry = { publicName: string; description: string; image: string | null; displayOrder: number; showPrice: boolean }
export type WebsiteCatalogItem = WebsiteCatalogEntry & { itemId: string; kind: WebsiteCatalogKind; operationalName: string; active: boolean; price: number | null; configured: boolean; published: boolean }
export type WebsiteCatalogSettings = { items: WebsiteCatalogItem[]; total: number; page: number; pageSize: number; catalog: {integration:'ready';publishedItemCount:number} }
export type PublicWebsiteCatalogItem = { publicId: string; kind: WebsiteCatalogKind; name: string; description: string; image: string | null; displayOrder: number } & ({priceMode:'contact';price?:never;currency?:never}|{priceMode:'shown';price:number;currency:string})
export type PublicWebsiteCatalog = { canonicalSlug:string;items:PublicWebsiteCatalogItem[];total:number;page:number;pageSize:number }
export const emptyWebsiteCatalogEntry = (): WebsiteCatalogEntry => ({publicName:'',description:'',image:null,displayOrder:0,showPrice:false})
export function parseWebsiteCatalogSettings(value:unknown):WebsiteCatalogSettings {
  const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
  if(!record(value)||!Array.isArray(value.items)||!Number.isSafeInteger(value.total)||Number(value.total)<0||!Number.isSafeInteger(value.page)||Number(value.page)<1||value.pageSize!==20||!record(value.catalog)||value.catalog.integration!=='ready'||!Number.isSafeInteger(value.catalog.publishedItemCount)||Number(value.catalog.publishedItemCount)<0) throw new Error('INVALID_PUBLIC_CATALOG_RESPONSE')
  for(const item of value.items) if(!record(item)||typeof item.itemId!=='string'||typeof item.kind!=='string'||!['product','service'].includes(item.kind)||typeof item.operationalName!=='string'||typeof item.active!=='boolean'||typeof item.configured!=='boolean'||typeof item.published!=='boolean'||typeof item.publicName!=='string'||typeof item.description!=='string'||typeof item.showPrice!=='boolean'||!Number.isSafeInteger(item.displayOrder)||Number(item.displayOrder)<0||Number(item.displayOrder)>999999||!(item.price===null||typeof item.price==='number'&&Number.isFinite(item.price))||!(item.image===null||typeof item.image==='string'&&item.image.length<=175000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.image))) throw new Error('INVALID_PUBLIC_CATALOG_RESPONSE')
  return value as WebsiteCatalogSettings
}
