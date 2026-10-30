export interface BsScaleCaptureForm { profileId: string; productId: string }
export interface BsScaleCaptureCopy { title: string; open: string; device: string; product: string; connect: string; disconnect: string; read: string; tare: string; confirm: string; close: string; retry: string; more: string; loading: string; status: string; net: string; tareWeight: string; gross: string; stockQuantity: string; factor: string; setup: string; source: string }
export interface BsScaleCaptureView {
 available: boolean; loading: boolean; error: string; notice: string; status: string; pending: boolean; locked: boolean; dirty: boolean
 canConnect: boolean; canDisconnect: boolean; canRead: boolean; canTare: boolean; canSubmit: boolean; deviceLocked: boolean; productLocked: boolean
 profiles: { value: string; label: string }[]; products: { id: string; name: string }[]; productLoading: boolean; productError: string | null; productHasMore: boolean
 fields: { label: string; value: string }[]; factorNotice: string; deviceNotice: string; setupTo?: string
}
