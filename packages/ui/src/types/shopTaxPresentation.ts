export interface BsShopTaxRuleForm { treatment: string; rate: string; priceMode: string; subtype: string }
export interface BsShopTaxItemForm extends BsShopTaxRuleForm { id: string; name: string; itemType: string; override: boolean }
export interface BsShopTaxForm { enabled: boolean; effectiveAt: string; reason: string; default: BsShopTaxRuleForm; items: BsShopTaxItemForm[] }
export interface BsShopTaxCopy {
 title: string; help: string; edit: string; enabled: string; effectiveAt: string; reason: string; save: string; cancel: string;
 treatment: string; rate: string; priceMode: string; subtype: string; vat: string; zero_rated: string; exempt: string; non_taxable: string;
 inclusive: string; exclusive: string; defaults: string; overrides: string; override: string; loading: string; error: string; retry: string;
 saved: string; noContext: string; history: string; empty: string
}
export interface BsShopTaxVersionRow { id: string; effectiveAt: string; reason: string; enabled: string }
