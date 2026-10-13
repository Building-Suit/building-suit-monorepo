# Optional catalog images

Products and services use the same shared `BsCatalogImageUploader` presentation and `useFileUpload` interaction lifecycle. Shop owns file validation, permissions, tenant-scoped transport and atomic catalog saves. The optional uploader replaces URL entry; existing HTTPS image metadata remains compatible.

Uploads use private `shop-catalog-images` Storage objects with immutable `<shop UUID>/<products|services>/<random UUID>.<jpg|png|webp>` keys. The client uses the authenticated Supabase SDK, never a service key. Storage checks the owning Shop's existing write permission and subscription helper, MIME and size; signing requires catalog or sales read permissions in that tenant. No anonymous, overwrite or delete policy is added. Replacement/removal changes the catalog reference through its existing authorized save transaction. Failed image loads retain the neutral fallback.

The implementation proposes JPEG/PNG/WebP, 5 MB and 16 million decoded pixels. Browser checks signatures and image decoding; Storage enforces MIME/size. Byte-level scanning is not a server guarantee. Signed URLs last one hour and are regenerated on catalog refresh; expired/unavailable images use the fallback.

## Separate operational gate

The new migration depends on PR #258's optional catalog-media migration. Neither has been applied here. Deploy them in order through the explicit Shop environment-bound runbook after review, verify private-bucket configuration and authorization with `supabase/tests/shop_catalog_image_upload.sql`, then verify real upload/sign/save/replace/remove flows. Before deployment, absent `supportsUploads` disables file controls while existing media-free saves remain usable.

Object upload and catalog save are separate operations. Abandoned, failed or replaced uploads are retained; this PR grants no client deletion. An operationally reviewed cleanup job should remove unreferenced objects after a safe retention window, with exact environment and tenant checks. Do not delete referenced objects or provider metadata directly.

SQL mutation tests remain unrun because the user's local Supabase stacks are stopped and must not be restarted. No hosted migration, secret/provider change, deployment or merge is authorized by this work.
