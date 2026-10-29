# Release plan and bilingual draft

Existing release reconciliation is BLOCKED; see RELEASE-RECONCILIATION.md. Preserve every immutable version, clock, retrospective label and receipt. Never change a public status directly. The trusted publisher owns one evolving upcoming candidate from actual main→stg net changes and a later exact production freeze/acknowledgment.

## Draft initiative copy — not published

EN title: Flexible units and measurement-based inventory

AR title: وحدات قياس مرنة وإدارة المخزون بالكميات

EN summary: Manage products sold by piece, meter, kilogram, and other measurements, with purchasing, sales, and inventory designed to keep quantities accurate.

AR summary: إدارة المنتجات التي تُباع بالقطعة أو المتر أو الكيلو جرام ووحدات قياس أخرى، مع ربط المشتريات والمبيعات والمخزون للحفاظ على دقة الكميات.

EN details: Choose a canonical stock unit and valid increments, receive and sell in compatible units or product packages, and preserve the original measurement on documents. Existing ordinary products retain their behavior.

AR details: اختر وحدة المخزون الأساسية والزيادات المسموح بها، واستلم وبع بوحدات متوافقة أو عبوات خاصة بالمنتج، مع حفظ القياس الأصلي في المستندات. تحتفظ المنتجات العادية الحالية بسلوكها.

## Planned milestone items

| ID / impact | English title and detail | Arabic title and detail | Evidence gate |
|---|---|---|---|
| shop-measurements / minor | Flexible units: accurate purchases, sales and stock with preserved document units. | وحدات قياس مرنة: مشتريات ومبيعات ومخزون دقيق مع حفظ الوحدات في المستندات. | Operational product/POS/receipt calls and M2 verified journey |
| shop-cable-reels / minor | Track cable reels and cuts: verify continuous lengths and record loss and remnants. | تتبع بكرات الكابلات والقص: التحقق من الأطوال المتصلة وتسجيل الفاقد والبقايا. | Reel allocation/cutting calls + M3 tests |
| shop-technical-catalog / minor | Technical product specifications: search separately stocked variants by approved attributes. | المواصفات الفنية للمنتجات: البحث عن المتغيرات ذات المخزون المستقل حسب الخصائص المعتمدة. | Attribute queries + variant tests |
| shop-contractor-pricing / minor | Contractor pricing: apply authorized customer and quantity rules consistently. | أسعار المقاولين: تطبيق قواعد العميل والكميات المصرح بها باتساق. | Authoritative pricing call + precedence tests |
| shop-orders / minor | Quotations and sales orders: retain agreed prices and track reservations and partial fulfillment. | عروض الأسعار وأوامر البيع: حفظ الأسعار المتفق عليها وتتبع الحجز والتنفيذ الجزئي. | Transition/reservation/fulfillment calls + M4 tests |
| shop-supplier-orders / minor | Supplier orders: track ordered, received and remaining quantities. | أوامر الموردين: تتبع الكميات المطلوبة والمستلمة والمتبقية. | Receiving calls + idempotency tests |
| shop-warehouse-measurement / minor | Warehouse measurement tools: use supported devices and storage information. | أدوات قياس المستودع: استخدام الأجهزة المدعومة وبيانات التخزين. | Named adapter integration + device acceptance |

These are drafts. Add distinctive current-code probes, accepted fragment sources and public inventory entries only for the scope actually delivered. M1 backend preparation remains internally classified until an operational customer capability is enabled and verified. Never invent targetVersion or publish plans, reels, wholesale or scale support as shipped.
