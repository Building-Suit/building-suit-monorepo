export interface ShopHqSaleSelection {
  customer: { id: string; name: string }
  services: Array<{ id: string; name: string; unitPrice: number; discount: number }>
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | null
}
