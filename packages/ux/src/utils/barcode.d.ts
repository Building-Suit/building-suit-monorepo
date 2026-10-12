export interface BarcodeScanState { value: string; lastAt: number }
export function emptyScanState(): BarcodeScanState
export function captureBarcodeKey(state: BarcodeScanState, key: string, occurredAt: number, options?: { maxGap?: number; minLength?: number }): { state: BarcodeScanState; code: string | null }
