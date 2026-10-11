export interface TextDownloadOptions { mount?: boolean; cleanupDelayMs?: number }
export function downloadText(filename: string, text: string, mimeType: string, options?: TextDownloadOptions): void

export function downloadBlob(filename: string, blob: Blob, options?: TextDownloadOptions): void
