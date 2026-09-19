# تتبع المتطلبات والأدلة

تاريخ الأساس: 2026-09-19؛ مصدر المتطلبات [القبول](ACCEPTANCE_AR.md). كل حالة تحتفظ بمعرفها الأصلي. التنفيذ الآلي وUAT والنشر أبعاد مستقلة؛ لا ق٠١–ق٢٤ مقبولة بهذه الحزمة وحدها.

| المتطلب | الحزمة | التنفيذ/الدليل الآلي المخطط | UAT | النشر |
|---|---|---|---|---|
| المثال المتكامل §١ | AS-S1-01 | REF-01–03، tests/unit/accountant-reference.test.mjs؛ حساب fixture مستقل فقط، PASS: 4 اختبارات | NOT_STARTED | غير إنتاجي |
| رحلة الحساب والسياق واللغة §٣ | AS-S1-01 ثم AS-S3-01A | account-activity.spec.ts: كشف وقيد وحساب وعودة en/ar على دفتر محلي فعلي؛ الصفحة والتاريخ والتركيز والبحث محفوظة | NOT_STARTED | محلي فقط |
| ظهور الحساب والصفحات §٣ | موجود قبل الحزمة / AS-S2-02 | tests/e2e/accounts-table.spec.ts؛ نتائج 18 السابقة تاريخية | NOT_STARTED | نسخة الأساس لا تثبت النشر الحالي |

| الحالة | الحزمة المالكة | موضع التحقيق/التنفيذ الحالي | حدود الدليل الآلي | UAT | دليل النشر |
|---|---|---|---|---|---|
| ق٠١ | AS-S3-01 | posting_engine؛ 01_accounting_integrity_test.sql | توازن قاعدة موجود؛ ليس قبول المرحلة | NOT_STARTED | NOT_VERIFIED |
| ق٠٢ | AS-S2-01 / AS-S3-03 | account_nature_and_contra_reporting.sql، dated_statement_classification.sql | الطبيعة وcontra منفذان؛ العرض المصنف يحتفظ بالإشارة. لا ادعاء اكتمال ميزان الست خانات | NOT_STARTED | NOT_VERIFIED |
| ق٠٣ | AS-S2-02A ثم بقية AS-S2-02 | explicit_account_groups.sql، accounts.vue | group/posting منفذ: SQL وUI PASS؛ control باقٍ؛ التصنيف في AS-S2-01B يرفض group | NOT_STARTED | NOT_VERIFIED |
| ق٠٤ | AS-S3-01A ثم AS-S3-02 / AS-S3-03 | read_account_activity | افتتاح فترة بلا حركة مثبت SQL/browser؛ لا اكتمال لمعالج الافتتاح أو الميزان | NOT_STARTED | NOT_VERIFIED |
| ق٠٥ | AS-S3-02 | post_opening_balance | معالج ومطابقة مساعد غير منفذين | NOT_STARTED | NOT_VERIFIED |
| ق٠٦ | AS-S3-02 | transaction_flows | التكرار الحالي ليس قبولًا لاستيراد الافتتاح | NOT_STARTED | NOT_VERIFIED |
| ق٠٧ | AS-S2-02 / AS-S3-01 | account_nature_and_contra_reporting.sql، report_general_ledger | إصلاح قراءة المؤرشف موجود في حزمة الطبيعة؛ AS-S2-01B يبقي سجل التصنيف والتقرير قابلين للقراءة ويرفض كتابة جديدة للمؤرشف | NOT_STARTED | NOT_VERIFIED |
| ق٠٨ | AS-S2-01B / AS-S2-02 / AS-S6-02 | dated_statement_classification.sql، statement-classification.spec.ts | تنفيذ جزئي: عرض مؤرخ مستقبلي دون تغيير تقارير الماضي، سجل غير قابل للمحو، CSV يطابق التاريخ. إعادة العرض التاريخية المعتمدة لم تنفذ | NOT_STARTED | NOT_VERIFIED |
| ق٠٩ | AS-S4-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٠ | AS-S4-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١١ | AS-S4-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٢ | AS-S4-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٣ | AS-S4-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٤ | AS-S5-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٥ | AS-S5-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٦ | AS-S5-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٧ | AS-S5-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٨ | AS-S5-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق١٩ | AS-S5-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٢٠ | AS-S6-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٢١ | AS-S4-02 / AS-S6-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٢٢ | AS-S6-02 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٢٣ | AS-S6-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٢٤ | AS-S7-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |

اختبارات SQL الحالية دليل مستقل وحدوده هي الحالات التي تتحقق منها بالفعل؛ لا يثبت نموذج الرفض الاصطناعي RLS. نتائج التشغيل الفعلية وrevision في [الحزمة](work-packages/AS-S1-01.md).

## دليل الحزمة AS-S1-01

2026-09-19: REF-01–03 تمر في أربعة اختبارات Node باستخدام BigInt ووحدات صغرى؛ ليست اختبارات تقارير الإنتاج. JR-01 يغطي اختبار journal/account/back/close؛ JR-02 يغطي stable IDs والحالات والعزل؛ JR-03 يغطي أربعة اختبارات اللغة/المظهر وعينة أسماء مستقلة. يوجد اختبار تاسع لإعلان سلوك التحديث. الصور والسجل وSHA في [سجل الحزمة](work-packages/AS-S1-01.md). SQL والانحدار المرتبط بقاعدة غير مشغّلين بسبب تعارض backend؛ لا ترقية لأي ق٠١–ق٢٤ أو UAT أو نشر.

استئناف 2026-09-19، 09:11 UTC: SQL أصبح PASS (27 ملفًا، 678 assertion) على نسخة محلية مستقلة ذات تاريخ مطابق للمرشح، بما فيها 01_accounting_integrity_test.sql و02_tenant_isolation_test.sql. لا يثبت ذلك اكتمال كل شروط ق٠١ أو المثال المرجعي في الإنتاج؛ بقية ق٠١–ق٢٤ وUAT والنشر لا تتغير. انحدار المتصفح الحالي ما زال NOT_RUN. [دليل SQL وبصماته](../evidence/as-s1-01/sql-verification.json).

## AS-S2-02A — حسابات تجميعية صريحة

تفويض AS-E02 يسمح بالتنفيذ دون انتظار المحاسب. على مصدر 7f28516: 747 assertion SQL/29 ملفًا و23 browser و28 unit PASS. منع group في RPC وINSERT/UPDATE المباشر، منع العميل من grant مباشر، فصل الصلاحية/tenant، parent posting وتوافق العقود القديمة، وصون 4 حسابات/3 معاملات/6 بنود والأرصدة والتقرير قبل وبعد. [الحزمة](work-packages/AS-S2-02A.md) و[السجل](../evidence/as-s2-02a/verification.json). ق٠٣ له دليل هندسي محدد، ولا يدعي اكتمال المراقبة أو تصنيف التاريخ أو UAT/إطلاق؛ ق٠١–ق٢٤ ليست تلقائيًا ACCEPTED.

## AS-S2-01B — عرض المركز المالي المؤرخ، 2026-09-19

المصدر `ea52426589880559af914ef820df79992d4cfaeb`. PASS: 795 assertion/30 SQL، و27 browser (4 جديدة +23 انحدار)، و39 unit، وcheck/lint/typecheck/build. تجربة ترحيل مستقلة حفظت 4 حسابات/3 معاملات/6 بنود والأرصدة والتقرير دون backfill. ثلاثة سيناريوهات تزامن حقيقية مرت؛ security advisors وDB lint سليمان، مع 10 تحذيرات أداء قائمة موثقة. [تفاصيل الحزمة](work-packages/AS-S2-01B.md) و[الأدلة القابلة لإعادة التشغيل](../evidence/as-s2-01b/README.md).

ق٠٨ منفذ جزئيًا: نسخة عرض بتاريخ مستقبلي وسجل غير قابل للمحو وتصنيف التقرير/CSV حسب التاريخ. طبيعة الحساب وإشارة contra والتاريخ السابق محفوظة. إعادة العرض التاريخية المعتمدة وتصنيف قائمة النتيجة والتقسيم الجزئي ليست منفذة؛ لا ترقية ق٠١–ق٢٤ إلى ACCEPTED أو ادعاء UAT/نشر. اختبارات browser للتأخير/تبديل المنشأة تستخدم fixtures للعزل البصري؛ إثبات RLS والصلاحيات في SQL مستقل.

## AS-S3-01A — كشف الحساب والقيد الحي، 2026-09-19

833 assertion SQL/31 ملفًا و39 unit PASS؛ منها 38 assertion للكشف والقيود. browser: PASS: 30 حالة (3 جديدة +27 انحدار)؛ إعادة تشغيل الثلاث الجديدة بعد إصلاح fixture: 32.4s. بيانات en/ar تُنشأ وتُرحل عبر RPC الفعلية، وviewer يقرأها. fixture مستقل يثبت إلغاء الرد المتأخر والخطأ/إعادة المحاولة؛ عزل المنشأة والصلاحيات يثبته SQL مستقل. الأرشفة والعكس والدقة فوق 2^53 مشمولة. [الحزمة](work-packages/AS-S3-01A.md) و[الدليل](../evidence/as-s3-01a/README.md). لا ترقية ق٠١–ق٢٤ إلى ACCEPTED أو ادعاء UAT/نشر.


## AS-UX-01 — مركز المعاملات وشجرة الحسابات، 2026-09-19

طلب المؤسس محدد لتسهيل الاستخدام ضمن §٣/§٤/§٦. الحسابات تعرض شجرة بعناوين ثابتة، وتحتفظ بالأب أثناء البحث وبكشف الحساب وإضافة الفرع؛ المعاملات تجمع الأنواع والفلاتر والإنشاء والروابط السابقة. PASS: 44 unit و41 سيناريو browser مختلف عبر التشغيلات الموثقة، مع ترحيل قيد حقيقي en/ar واستمرار فلاتر المستخدم، viewer وحالتي اشتراك للقراءة فقط، وانحدار الحسابات والتقارير والحصص. fixture التأخير يثبت منع العرض المتقادم؛ لا يُقدم كدليل RLS جديد. SQL لم يُعد تشغيله؛ لا تعديلات قاعدة بيانات. [الحزمة](work-packages/AS-UX-01.md) و[الأدلة](../evidence/as-ux-01/README.md). لا ترقية ق٠١–ق٢٤ إلى ACCEPTED أو ادعاء UAT/نشر.
