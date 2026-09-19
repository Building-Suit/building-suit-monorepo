# تتبع المتطلبات والأدلة

تاريخ الأساس: 2026-09-19؛ مصدر المتطلبات [القبول](ACCEPTANCE_AR.md). كل حالة تحتفظ بمعرفها الأصلي. التنفيذ الآلي وUAT والنشر أبعاد مستقلة؛ لا ق٠١–ق٢٤ مقبولة بهذه الحزمة وحدها.

| المتطلب | الحزمة | التنفيذ/الدليل الآلي المخطط | UAT | النشر |
|---|---|---|---|---|
| المثال المتكامل §١ | AS-S1-01 | REF-01–03، tests/unit/accountant-reference.test.mjs؛ حساب fixture مستقل فقط، PASS: 4 اختبارات | NOT_STARTED | غير إنتاجي |
| رحلة الحساب والسياق واللغة §٣ | AS-S1-01 ثم AS-S3-01 | tests/review-journey.spec.ts؛ اصطناعي فقط، PASS: 9 اختبارات | NOT_STARTED | غير إنتاجي |
| ظهور الحساب والصفحات §٣ | موجود قبل الحزمة / AS-S2-02 | tests/e2e/accounts-table.spec.ts؛ نتائج 18 السابقة تاريخية | NOT_STARTED | نسخة الأساس لا تثبت النشر الحالي |

| الحالة | الحزمة المالكة | موضع التحقيق/التنفيذ الحالي | حدود الدليل الآلي | UAT | دليل النشر |
|---|---|---|---|---|---|
| ق٠١ | AS-S3-01 | posting_engine؛ 01_accounting_integrity_test.sql | توازن قاعدة موجود؛ ليس قبول المرحلة | NOT_STARTED | NOT_VERIFIED |
| ق٠٢ | AS-S2-01 / AS-S3-03 | accounts.sql، reporting.sql | الطبيعة المقابلة غير مكتملة في الأساس | NOT_STARTED | NOT_VERIFIED |
| ق٠٣ | AS-S2-02 | posting_engine، accounts.vue | منع التجميعي/المراقبة وتاريخ الآباء غير مكتمل | NOT_STARTED | NOT_VERIFIED |
| ق٠٤ | AS-S3-02 / AS-S3-03 | report_general_ledger | افتتاح بلا حركة يحتاج عقدًا واختبارًا | NOT_STARTED | NOT_VERIFIED |
| ق٠٥ | AS-S3-02 | post_opening_balance | معالج ومطابقة مساعد غير منفذين | NOT_STARTED | NOT_VERIFIED |
| ق٠٦ | AS-S3-02 | transaction_flows | التكرار الحالي ليس قبولًا لاستيراد الافتتاح | NOT_STARTED | NOT_VERIFIED |
| ق٠٧ | AS-S2-02 / AS-S3-01 | app.require_account، report_general_ledger | الأرشفة تمنع كشف الدالة؛ بوابة لاحقة | NOT_STARTED | NOT_VERIFIED |
| ق٠٨ | AS-S2-02 / AS-S6-02 | accounts، reporting | التصنيف المؤرخ غير منفذ | NOT_STARTED | NOT_VERIFIED |
| ق٩ | AS-S4-01 | انظر فجوة EVIDENCE_AR.md والخطة | غير مثبت كتدفق تطبيق مكتمل | NOT_STARTED | NOT_VERIFIED |
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

اختبارات SQL الحالية تُراجع كمصدر مستقل، ولا ينسب إليها نجاح جديد دون تشغيل. لا يثبت نموذج الرفض الاصطناعي RLS. نتائج التشغيل الفعلية وrevision في [الحزمة](work-packages/AS-S1-01.md).

## دليل الحزمة AS-S1-01

2026-09-19: REF-01–03 تمر في أربعة اختبارات Node باستخدام BigInt ووحدات صغرى؛ ليست اختبارات تقارير الإنتاج. JR-01 يغطي اختبار journal/account/back/close؛ JR-02 يغطي stable IDs والحالات والعزل؛ JR-03 يغطي أربعة اختبارات اللغة/المظهر وعينة أسماء مستقلة. يوجد اختبار تاسع لإعلان سلوك التحديث. الصور والسجل وSHA في [سجل الحزمة](work-packages/AS-S1-01.md). SQL والانحدار المرتبط بقاعدة غير مشغّلين بسبب تعارض backend؛ لا ترقية لأي ق٠١–ق٢٤ أو UAT أو نشر.
