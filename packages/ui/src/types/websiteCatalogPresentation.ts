export type BsWebsiteCatalogForm = { publicName:string;description:string;image:string|null;displayOrder:number;showPrice:boolean }
export type BsWebsiteCatalogRow = { id:string;name:string;kindLabel:string;publicationLabel:string;priceLabel:string;canPublish:boolean;canUnpublish:boolean }
export type BsWebsiteCatalogView = {
  title:string;help:string;loading:boolean;denied:boolean;failed:boolean;pending:boolean;dirty:boolean;error:string;success:string
  rows:BsWebsiteCatalogRow[];page:number;total:number;editorTitle:string
  copy:Record<'loading'|'denied'|'failed'|'retry'|'search'|'name'|'kind'|'state'|'price'|'edit'|'publish'|'unpublish'|'save'|'cancel'|'publicName'|'description'|'image'|'imageHelp'|'removeImage'|'displayOrder'|'showPrice'|'previous'|'next',string>
}
