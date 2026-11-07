export interface BsStorefrontLayoutForm {
 banner: { image: string; alt: string; title: string; subtitle: string } | null
 gallery: { image: string; caption: string }[]
 staff: { image: string | null; name: string; role: string; bio: string }[]
 showOffers: boolean; showGallery: boolean; showStaff: boolean
}
export interface BsStorefrontBuilderView { available: boolean; loading: boolean; failed: boolean; eligible: boolean; owner: boolean; websitePublished: boolean; pending: boolean; dirty: boolean; error: string; success: string; published: boolean }
export interface BsOfferCardView { id: string; name: string; description: string; price: string; oldPrice: string; saving: string; items: string; images: string[]; disabled?: boolean }
export interface BsCatalogOfferForm { name: string; description: string; price: number; priority: number; active: boolean; websiteVisible: boolean; startsAt: string; endsAt: string; lines: { kind: 'product' | 'service'; sourceId: string; name: string; quantity: number; price: string }[] }
export interface BsCatalogOffersView { available: boolean; loading: boolean; failed: boolean; canManage: boolean; canPublish: boolean; pending: boolean; dirty: boolean; error: string; success: string; page: number; total: number; rows: { id: string; name: string; items: string; price: string; oldPrice: string; status: string }[]; sourceOptions: { key: string; label: string }[]; sourceLoading: boolean; sourceFailed: boolean; sourceHasMore: boolean; oldPrice: string; saving: string }

export type BsStorefrontBuilderCopy = Record<'addImage'|'addStaff'|'alt'|'banner'|'bannerSubtitle'|'bannerTitle'|'billing'|'bio'|'cancel'|'caption'|'catalog'|'down'|'draft'|'edit'|'failed'|'gallery'|'help'|'imageHelp'|'loading'|'name'|'noBanner'|'noShop'|'offers'|'portrait'|'preview'|'previewHelp'|'profile'|'publish'|'publishHelp'|'publishProfile'|'published'|'remove'|'removeImage'|'retry'|'role'|'save'|'search'|'sections'|'showGallery'|'showOffers'|'showStaff'|'staff'|'staffHelp'|'teamMulti'|'title'|'up'|'upgradeHelp'|'uploadBanner',string>

export type BsCatalogOffersCopy = Record<'active'|'addItem'|'cancel'|'create'|'decrease'|'description'|'edit'|'ends'|'failed'|'help'|'increase'|'items'|'loading'|'matchHelp'|'more'|'name'|'next'|'noShop'|'oldPrice'|'previous'|'price'|'priority'|'priorityHelp'|'publicationHelp'|'quantity'|'remove'|'retry'|'save'|'saving'|'starts'|'status'|'title'|'websiteVisible',string>
