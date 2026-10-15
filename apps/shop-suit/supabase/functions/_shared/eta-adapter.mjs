// Versioned pure adapter. Numeric arithmetic uses integer 1/100000 EGP components.
export const ADAPTER_VERSION = 'shop-ereceipt-1.2-v1'
export class EtaError extends Error { constructor(code) { super(code); this.code = code } }
const fail = code => { throw new EtaError(code) }
const str = (value, max, pattern) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && (!pattern || pattern.test(value))
export function validateProfile(profile) {
 const missing = []
 for (const [key, max, pattern] of [['legalName', 200], ['rin', 9, /^\d{9}$/], ['activityCode', 10, /^\d{4,10}$/]]) if (!str(profile?.[key], max, pattern)) missing.push(key)
 return missing
}
export function validateBranch(branch) {
 const missing = []
 for (const [key, max] of [['branchCode', 50], ['deviceSerialNumber', 100]]) if (!str(branch?.[key], max)) missing.push(key)
 for (const [key, max] of [['governate',100], ['regionCity',100], ['street',200], ['buildingNumber',100]]) if (!str(branch?.address?.[key], max)) missing.push(`address.${key}`)
 if (branch?.address?.country !== 'EG') missing.push('address.country')
 return missing
}
export function validateItem(item, rin) {
 return ['GS1','EGS'].includes(item?.itemType) && str(item.itemCode,100, item.itemType === 'GS1' ? /^\d{8,14}$/ : new RegExp(`^EG-${rin}-[A-Za-z0-9_-]+$`)) && str(item.unitType,30,/^[A-Za-z0-9]+$/)
}
const units = value => {
 const text = String(value)
 if (!/^\d+(?:\.\d{1,5})?$/.test(text)) fail('ETA_COMPONENT_PRECISION_UNSUPPORTED')
 const [whole, fraction = ''] = text.split('.')
 return BigInt(whole) * 100000n + BigInt(fraction.padEnd(5, '0'))
}
const decimal = value => {
 if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) fail('ETA_COMPONENT_RANGE_UNSUPPORTED')
 const result = Number(`${value / 100000n}.${String(value % 100000n).padStart(5,'0')}`)
 if (units(result) !== value) fail('ETA_COMPONENT_RANGE_UNSUPPORTED')
 return result
}
const roundDivide = (n, d) => (n + d / 2n) / d
const sum = (rows, key) => rows.reduce((n,row) => n + units(row[key]),0n)
// ETA serialization preserves insertion order and numeric lexical values of our own
// deterministic wire output. Never hash a re-ordered JSONB representation.
export function serializeEta(value) {
 if (value === null || value === undefined) fail('ETA_NULL_UNSUPPORTED')
 if (typeof value !== 'object') return JSON.stringify(String(value))
 return Object.entries(value).map(([key, entry]) => {
  const name = JSON.stringify(key.toUpperCase())
  return name + (Array.isArray(entry) ? entry.map(item => name + serializeEta(item)).join('') : serializeEta(entry))
 }).join('')
}
export async function receiptUuid(receipt) {
 const input = structuredClone(receipt)
 // UUID is empty during hashing, as required by the receipt issuance algorithm.
 input.header.uuid = ''
 const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serializeEta(input)))
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}
export async function buildReceipt(source, previousUUID = '') {
 if (source.channel !== 'ereceipt') fail('ETA_EINVOICE_REQUIRES_SEPARATE_ADAPTER_AND_CADES_BES')
 if (source.currency !== 'EGP') fail('ETA_EXPORT_EGP_ONLY')
 if (validateProfile(source.profile).length || validateBranch(source.branch).length) fail('ETA_CONFIGURATION_INCOMPLETE')
 if (previousUUID && !/^[a-f0-9]{64}$/.test(previousUUID)) fail('ETA_INVALID_PREVIOUS_UUID')
 const snap = source.tax
 if (snap?.version !== 1 || snap.componentDecimals !== 5 || !snap.calculationEnabled || !Array.isArray(snap.lines) || !snap.lines.length) fail('ETA_LEGACY_SNAPSHOT_UNSUPPORTED')
 if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(source.issuedAt) || !Number.isFinite(Date.parse(source.issuedAt))) fail('ETA_ISSUANCE_DATE_REQUIRED')
 if (!str(source.receiptNumber,50)) fail('ETA_RECEIPT_NUMBER_REQUIRED')
 const buyer = source.buyer
 if (!['P','F'].includes(buyer?.type)) fail('ETA_B2B_REQUIRES_EINVOICE_CONTRACT')
 if (buyer.id && !str(buyer.id,30,buyer.type === 'P' ? /^\d{14}$/ : undefined)) fail('ETA_BUYER_ID_INVALID')
 if (buyer.name && !str(buyer.name,100)) fail('ETA_BUYER_NAME_INVALID')
 if (units(snap.total5) >= 15000000000n && (!buyer.id || !buyer.name)) fail('ETA_BUYER_IDENTITY_REQUIRED')
 if (buyer.type === 'F' && (!buyer.id || !buyer.name)) fail('ETA_BUYER_IDENTITY_REQUIRED')
 if (!['C','V','CC','VC','VO','O'].includes(source.paymentMethod)) fail('ETA_PAYMENT_METHOD_UNSUPPORTED')
 const itemData = snap.lines.map(line => {
  const code = source.items.find(item=>item.sourceId === line.sourceId && item.sourceType === line.itemType)
  if (!validateItem(code, source.profile.rin)) fail('ETA_ITEM_CODES_REQUIRED')
  const description = source.names[line.id]
  if (!str(description,500)) fail('ETA_ITEM_DESCRIPTION_REQUIRED')
  const rule = line.rule
  const allowed = {vat:['V009','V010'],zero_rated:['V001','V002','V010'],exempt:['V003','V005','V006','V007','V008'],non_taxable:['V004']}
  if (!rule || Object.keys(rule).some(key=>!['treatment','rate','priceMode','subtype','taxType','itemType','sourceId'].includes(key)) || (rule.taxType && rule.taxType !== 'T1') || (!Object.hasOwn(allowed,rule.treatment) || !allowed[rule.treatment].includes(rule.subtype)) || !['inclusive','exclusive'].includes(rule.priceMode)) fail('ETA_TAX_TREATMENT_UNSUPPORTED')
  const rate = units(rule.rate)
  if (rate > 10000000n || rate % 1000n || (rule.treatment !== 'vat' && rate !== 0n) || (rule.treatment === 'vat' && rate === 0n)) fail('ETA_TAX_RATE_UNSUPPORTED')
  const quantity = units(line.originalQuantity), net = units(line.net5), tax = units(line.tax5), discount = units(line.discountNet5)
  if (quantity === 0n || net + tax !== units(line.total5) || roundDivide(net * rate,10000000n) !== tax) fail('ETA_COMPONENT_EQUATION_UNSUPPORTED')
  const preDiscount = net + discount
  const unitPrice = roundDivide(preDiscount * 100000n, quantity)
  if (roundDivide(unitPrice * quantity,100000n) !== preDiscount) fail('ETA_UNIT_PRICE_PRECISION_UNSUPPORTED')
  return { internalCode: line.sourceId, description, itemType: code.itemType, itemCode: code.itemCode, unitType: code.unitType,
   quantity: decimal(quantity), unitPrice: decimal(unitPrice), netSale: decimal(net), totalSale: decimal(preDiscount), total: decimal(net+tax),
   ...(discount ? { commercialDiscountData: [{ amount: decimal(discount), description: 'Original sale discount' }] } : {}),
   taxableItems: [{taxType:'T1', amount:decimal(tax), subType:rule.subtype, rate:decimal(rate)}] }
 })
 const net = sum(itemData,'netSale'), tax = itemData.reduce((n,line)=>n+units(line.taxableItems[0].amount),0n)
 // Export exact original components. A rounding difference is not a fee/adjustment.
 if (net !== units(snap.net5) || tax !== units(snap.tax5) || net+tax !== units(snap.total5) || net+tax !== units(snap.total)) fail('ETA_MONEY_ROUNDING_UNSUPPORTED')
 const header = {dateTimeIssued:source.issuedAt, receiptNumber:source.receiptNumber, uuid:'', previousUUID, currency:'EGP'}
 if (source.kind === 'return') {
  if (!/^[a-f0-9]{64}$/.test(source.original?.uuid) || !source.original?.snapshotId || !source.original?.issuedAt) fail('ETA_ORIGINAL_REFERENCE_REQUIRED')
  header.referenceUUID = source.original.uuid
  header.salesIssuedDateTime = source.original.issuedAt
 } else if (source.kind === 'correction') {
  if (!/^[a-f0-9]{64}$/.test(source.invalidOriginal?.uuid) || source.invalidOriginal.status !== 'invalid') fail('ETA_INVALID_ORIGINAL_REQUIRED')
  if (source.invalidOriginal.previousUUID !== previousUUID) fail('ETA_CORRECTION_CHAIN_MISMATCH')
  header.referenceOldUUID = source.invalidOriginal.uuid
 } else if (source.kind !== 'sale') fail('ETA_DOCUMENT_KIND_UNSUPPORTED')
 const branchAddress = Object.fromEntries(['country','governate','regionCity','street','buildingNumber'].map(key=>[key,source.branch.address[key]]))
 const buyerProjection = {type:buyer.type,...(buyer.id?{id:buyer.id}:{}),...(buyer.name?{name:buyer.name}:{})}
 const receipt = { header, documentType:{receiptType:source.kind === 'return'?'r':'s',typeVersion:'1.2'},
  seller:{rin:source.profile.rin,companyTradeName:source.profile.legalName,branchCode:source.branch.branchCode,branchAddress,deviceSerialNumber:source.branch.deviceSerialNumber,activityCode:source.profile.activityCode},
  buyer:buyerProjection, itemData, totalSales:decimal(sum(itemData,'totalSale')), totalCommercialDiscount:decimal(sum(itemData,'totalSale')-net), totalItemsDiscount:0,
  netAmount:decimal(net), feesAmount:0, totalAmount:decimal(net+tax), taxTotals:[{taxType:'T1',amount:decimal(tax)}], paymentMethod:source.paymentMethod, adjustment:0 }
 receipt.header.uuid = await receiptUuid(receipt)
 return {adapterVersion:ADAPTER_VERSION, uuid:receipt.header.uuid, receipt, body:JSON.stringify({receipts:[receipt]})}
}
// Deliberately separate B2B contract: never route an invoice through receipts.
export const EINVOICE_CONTRACT = Object.freeze({ channel:'einvoice', version:'1.0', signature:'CAdES-BES', activation:'provider_and_signing_required' })

export async function buildEinvoice(source, signer) {
 if (source.channel !== 'einvoice' || source.kind !== 'sale') fail('ETA_EINVOICE_CONTRACT_REQUIRED')
 const receiver=source.receiver
 if (receiver?.type !== 'B' || !str(receiver.id,9,/^\d{9}$/) || receiver.id === source.profile?.rin || !str(receiver.name,200) || !receiver.address || receiver.address.country !== 'EG') fail('ETA_EINVOICE_RECEIVER_REQUIRED')
 for (const key of ['governate','regionCity','street','buildingNumber']) if (!str(receiver.address[key],key === 'street'?200:100)) fail('ETA_EINVOICE_RECEIVER_ADDRESS_REQUIRED')
 // Reuse exact component validation; this intermediate receipt is never sent.
 // B2B identity, envelope, signature and endpoint remain separate contracts.
 const {receipt}=await buildReceipt({...source,channel:'ereceipt',buyer:{type:'F',id:receiver.id,name:receiver.name.slice(0,100)},paymentMethod:'O'})
 const receiverProjection={type:'B',id:receiver.id,name:receiver.name,address:Object.fromEntries(['country','governate','regionCity','street','buildingNumber'].map(key=>[key,receiver.address[key]]))}
 const document={issuer:{type:'B',id:source.profile.rin,name:source.profile.legalName,address:{branchId:source.branch.branchCode,...receipt.seller.branchAddress}},
  receiver:receiverProjection,documentType:'i',documentTypeVersion:'1.0',dateTimeIssued:source.issuedAt,taxpayerActivityCode:source.profile.activityCode,internalId:source.receiptNumber,
  invoiceLines:receipt.itemData.map(line=>({description:line.description,itemType:line.itemType,itemCode:line.itemCode,unitType:line.unitType,quantity:line.quantity,
   unitValue:{currencySold:'EGP',amountEGP:line.unitPrice},salesTotal:line.totalSale,total:line.total,valueDifference:0,totalTaxableFees:0,netTotal:line.netSale,itemsDiscount:0,
   ...(line.commercialDiscountData?{discount:{amount:line.commercialDiscountData[0].amount}}:{}),taxableItems:line.taxableItems,internalCode:line.internalCode})),
  totalSalesAmount:receipt.totalSales,totalDiscountAmount:receipt.totalCommercialDiscount,netAmount:receipt.netAmount,taxTotals:receipt.taxTotals,extraDiscountAmount:0,totalItemsDiscountAmount:0,totalAmount:receipt.totalAmount}
 if (!signer) fail('ETA_EINVOICE_CADES_BES_PROVIDER_REQUIRED')
 const signature=await signer(structuredClone(document),EINVOICE_CONTRACT)
 if (!str(signature,100000,/^[A-Za-z0-9+/]+={0,2}$/)) fail('ETA_EINVOICE_CADES_BES_PROVIDER_REQUIRED')
 return {adapterVersion:'shop-einvoice-1.0-v1',body:JSON.stringify({documents:[{...document,signatures:[{signatureType:'I',value:signature}]}]})}
}
