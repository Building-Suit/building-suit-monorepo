/** Classify message copy from catalog/draft or persisted line types only.
 * No shop mode, stock value, quantity, or pricing rules belong here.
 * @param {ReadonlyArray<{ itemType?: string, item_type?: string }>} lines
 */
export function saleTransactionType(lines) {
  const types = new Set(lines.map(line => line.itemType ?? line.item_type))
  // Incomplete/unknown lines must not promise inventory effects.
  if (!types.size || [...types].some(type => type !== 'product' && type !== 'service')) return 'empty'
  if (types.size === 2) return 'mixed'
  return types.has('product') ? 'product' : 'service'
}

/** Translate transaction messages without changing the command or its inputs.
 * @param {(key: string, values?: Record<string, string>) => string} translate
 * @param {string} key
 * @param {ReadonlyArray<{ itemType?: string, item_type?: string }>} lines
 * @param {Record<string, string>} values
 */
export function saleCopy(translate, key, lines, values = {}) {
  const prefix = `sales.inventoryCopy.${saleTransactionType(lines)}`
  return translate(key, {
    inventoryEffect: translate(`${prefix}.effect`),
    inventoryResult: translate(`${prefix}.result`),
    inventoryRestore: translate(`${prefix}.restore`),
    inventoryCheck: translate(`${prefix}.check`),
    inventoryError: translate(`${prefix}.error`),
    ...values,
  })
}
