// Test-only transcription of ACCEPTANCE_AR.md §1. No production imports.
// One fictional currency, precision 2. Strings serialize exact minor units.
export const journals = [
  { id: 'opening', cashFlow: 'opening', lines: [['bank', 'debit', '10000000'], ['inventory', 'debit', '2000000'], ['equipment', 'debit', '3000000'], ['accumulatedDepreciation', 'credit', '600000'], ['suppliers', 'credit', '1500000'], ['capital', 'credit', '12900000']] },
  { id: 'purchase', cashFlow: 'noncash', lines: [['inventory', 'debit', '1000000'], ['suppliers', 'credit', '1000000']] },
  { id: 'sale', cashFlow: 'noncash', lines: [['customers', 'debit', '1200000'], ['revenue', 'credit', '1200000']] },
  { id: 'costOfSale', cashFlow: 'noncash', lines: [['costOfSales', 'debit', '700000'], ['inventory', 'credit', '700000']] },
  { id: 'receipt', cashFlow: 'operating', lines: [['bank', 'debit', '500000'], ['customers', 'credit', '500000']] },
  { id: 'payment', cashFlow: 'operating', lines: [['suppliers', 'debit', '800000'], ['bank', 'credit', '800000']] },
  { id: 'rent', cashFlow: 'operating', lines: [['rent', 'debit', '200000'], ['bank', 'credit', '200000']] },
  { id: 'equipment', cashFlow: 'investing', lines: [['equipment', 'debit', '1200000'], ['bank', 'credit', '1200000']] },
  { id: 'depreciation', cashFlow: 'noncash', lines: [['depreciation', 'debit', '100000'], ['accumulatedDepreciation', 'credit', '100000']] },
  { id: 'transfer', cashFlow: 'internal', lines: [['cash', 'debit', '300000'], ['bank', 'credit', '300000']] },
]

// Expectations are literal source figures, not outputs of the calculation below.
export const expectedClosing = {
  bank: 8000000n, cash: 300000n, customers: 700000n, inventory: 2300000n,
  equipment: 4200000n, accumulatedDepreciation: -700000n,
  suppliers: -1700000n, capital: -12900000n, revenue: -1200000n,
  costOfSales: 700000n, rent: 200000n, depreciation: 100000n,
}
