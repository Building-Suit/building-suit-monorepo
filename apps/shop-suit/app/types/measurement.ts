/** Decimal string in new measurement APIs; never a floating point stock amount. */
export type MeasurementQuantity = string
export type MeasurementDimension = 'count' | 'length' | 'mass' | 'volume' | 'area' | 'package'
export interface PreparedProductMeasurement {
  baseUnitCode: string
  quantityIncrement: MeasurementQuantity
  status: 'prepared'
}
export interface ResolvedProductMeasurement extends PreparedProductMeasurement {
  enteredQuantity: MeasurementQuantity
  enteredUnitCode: string
  baseQuantity: MeasurementQuantity
}
