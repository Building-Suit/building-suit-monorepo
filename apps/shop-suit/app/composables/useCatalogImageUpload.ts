import { useFileUpload } from '@building-suit/ux'
import { CATALOG_IMAGE_BUCKET, catalogObjectName, validateCatalogUpload } from '~/utils/catalogUpload'
export function useCatalogImageUpload(shopId: Ref<string | null>, kind: 'products' | 'services', complete: (objectName: string) => void) {
  const client = useShopClient()
  const upload = useFileUpload({
    validate: async (file) => {
      await validateCatalogUpload(file)
      const bitmap = await createImageBitmap(file)
      const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 16000000
      bitmap.close()
      if (!valid) throw new Error('INVALID_CATALOG_IMAGE')
    },
    upload: async (file) => {
      const shop = shopId.value
      if (!shop) throw new Error('SHOP_PERMISSION_DENIED')
      const objectName = catalogObjectName(shop, kind, crypto.randomUUID(), file.type)
      const { error } = await client.storage.from(CATALOG_IMAGE_BUCKET).upload(objectName, file, { contentType: file.type, upsert: false })
      if (error || shopId.value !== shop) throw new Error('CATALOG_UPLOAD_FAILED')
      return objectName
    },
    complete,
  })
  const user = useSupabaseUser()
  watch([shopId, () => user.value?.id], () => upload.reset())
  return upload
}
