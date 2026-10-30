import { defineStore } from 'pinia'
import type { PublicWebsiteCatalogItem } from '#shared/websiteCatalog'
import { parsePublicWebsiteCatalog } from '#shared/publicWebsite'
export const useStorefrontBasketStore=defineStore('shop-storefront-basket',{
 state:()=>({scope:'',slug:'',lines:[] as {item:PublicWebsiteCatalogItem;quantity:number}[]}),
 actions:{
  selectScope(scope:string,slug:string){if(this.scope===scope)return;this.scope=scope;this.slug=slug;this.lines=[]},
  restore(){
   if(!import.meta.client)return
   try{
    const raw=JSON.parse(sessionStorage.getItem(`shop-basket:${this.scope}`)||'[]')
    if(!Array.isArray(raw)||raw.length>10)throw Error('INVALID_BASKET')
    const catalog=parsePublicWebsiteCatalog({canonicalSlug:this.slug,items:raw.map(line=>line.item),total:raw.length,page:1,pageSize:20},this.slug)
    if(raw.some(line=>typeof line.quantity!=='number'||!Number.isFinite(line.quantity)||line.quantity<=0||line.quantity>999)||new Set(catalog.items.map(item=>item.publicId)).size!==raw.length)throw Error('INVALID_BASKET')
    this.lines=catalog.items.map((item,index)=>({item,quantity:raw[index].quantity}))
   }catch{this.lines=[]}
  },
  persist(){if(import.meta.client)try{sessionStorage.setItem(`shop-basket:${this.scope}`,JSON.stringify(this.lines.map(line=>({...line,item:{...line.item,image:null,description:''}}))))}catch{/* Browsing and requests still work without optional basket storage. */}},
  add(item:PublicWebsiteCatalogItem){const existing=this.lines.find(line=>line.item.publicId===item.publicId);if(existing){existing.quantity=Math.min(999,existing.quantity+1);existing.item=item}else if(this.lines.length<10)this.lines.push({item,quantity:1});else return false;this.persist();return true},
  addBundle(items:{item:PublicWebsiteCatalogItem;quantity:number}[]){
   const next=this.lines.map(line=>({...line}))
   for(const addition of items){const old=next.find(line=>line.item.publicId===addition.item.publicId);const quantity=Math.round(((old?.quantity??0)+addition.quantity)*1000)/1000;if(quantity>999||quantity<.001)return false;if(old){old.quantity=quantity;old.item=addition.item}else next.push({...addition,quantity})}
   if(next.length>10)return false
   this.lines=next;this.persist();return true
  },
  quantity(id:string,value:number){if(!Number.isFinite(value))return;const line=this.lines.find(item=>item.item.publicId===id);if(!line)return;if(value<=0)this.lines=this.lines.filter(item=>item!==line);else line.quantity=Math.max(.001,Math.min(999,Math.round(value*1000)/1000));this.persist()},
  clear(){this.lines=[];this.persist()},
 },
})
