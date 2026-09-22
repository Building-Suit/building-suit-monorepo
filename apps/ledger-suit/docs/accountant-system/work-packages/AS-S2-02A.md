# AS-S2-02A — حسابات تجميعية دون تغيير التاريخ

الحالة `READY_FOR_REVIEW`؛ جزء محدود من المرحلة ٢، تابع AS-S2-02، القبول ق٠٣ مع حفظ ق٠١/ق٠٢/ق٠٧. خطة مثبتة قبل تعديلات الميزة، 2026-09-19. تفويض التنفيذ AS-E02 من المؤسس؛ لا انتظار قرار محاسب.

## النتيجة

ينشئ المستخدم حسابًا تجميعيًا واضح الدور للتنظيم؛ قاعدة البيانات تمنع إنشاء أي بند مباشر عليه حتى بالكتابة المباشرة. الحسابات الحالية والآباء ذات الحركات تبقى posting ولا يختفي تاريخها أو مجموعها. الاختيار القديم لإنشاء حساب يظل posting للتوافق.

## الحدود والاعتماديات

إعادة استعمال commit account-nature `00bc4d7` بعد مراجعته، دون لمس worktree مالكه؛ الحفاظ على أدلة Stage 1 وخطتها. يمتد دور الحساب عبر migration أمامي وRPC متوافق وview/types وصفحة الحسابات وselectors التابعة. لا تغيير shared packages. لا تعديل migrations موجودة؛ أي إصلاح يكون أماميًا.

خارج النطاق: حسابات مراقبة أو دفاتر مساعدة، تصنيف مؤرخ أو نقل بنود قديمة، سياسة مخزون/ضريبة/إقفال، إعادة بناء اليومية، دمج أو نشر أو تغيير مزود. النطاق لا يدعي اكتمال المرحلة ٢.

المسارات: `apps/ledger-suit/supabase/{migrations,tests}`، `app/pages/accounts.vue`، `app/composables/useOrgData.ts` حسب الحاجة، locales/types وtests/scripts داخل Ledger. يحتفظ shared UI بسلوكه.

## القبول والضمانات

- توافق الاستدعاءات القديمة والقيم الموجودة؛ إضافة role=posting دون إعادة ترحيل أو إعادة حساب التاريخ.
- group لا يقبل بندًا عبر RPC أو INSERT مباشر أو تغيير account_id؛ الصلاحية والعزل والحصص باقية.
- الدور لا يتغير بعد إنشاء الحساب في هذه الشريحة؛ تغيير اسم/code مسموح بالصلاحية القائمة. هذا يبسط صون التاريخ ويمنع سباق تحويل الدور.
- group ليس حساب contra أو system key أو default category/liquid resource؛ لا يعرض كمصدر مالي.
- يمكن اختيار group كأب لحساب جديد بنفس المنشأة والنوع والعملة. لا تعاد كتابة الروابط القائمة؛ لا تغيير parent للحسابات القائمة في هذه الشريحة.
- totals تشمل الحركات المباشرة على الآباء القديمة مرة واحدة؛ no implicit rollup.
- صفحة الحسابات تعرض الدور والنصوص en/ar، نموذج الإنشاء والحقول والقائمة المنسدلة، validation/error/permission states، وحفظ البحث/التحديث الحالي.

## خطة التحقق

قاعدة محلية جديدة مملوكة للحزمة بمنافذ مستقلة؛ لا استخدام أو reset لقاعدة account-nature. مطابقة migration history وبصمات المصدر قبل الفحص. SQL لجميع suites بالإضافة إلى المجموعة الجديدة؛ اختبار ترحيل قبل/بعد؛ browser عبر نسخة config محلية آمنة إذا بقي port المنتج مشغولًا، مع فحص هوية القاعدة وحصر جميع الطلبات محليًا. لا حذف للحمايات العامة أو توجيه اختبارات لبيئة مستضافة.

`pnpm check` و`pnpm test` وLedger lint/typecheck/build؛ توليد types من مصدر القاعدة؛ تسجيل pass/fail/not-run وعدد assertions والنسخة. stop للبيئة المؤقتة بعد الاختبار. تحديث README/master/status/decisions/traceability/evidence بنتيجة فعلية قبل التسليم.

## التنفيذ والدليل الفعلي

النسخة المختبرة: `7f28516e41d0526a9e0300d04924e5a69711e976` فوق أساس stg `6259188af06d6a49b03c5fe15708ea3411032113`. النطاق الأصلي محفوظ. إعادة استخدام commit `00bc4d7` تمت في `2f32c65`؛ تعارضات الدمج النصي اقتصرت على الوثائق وأوامر tests، وحُفظ المصدران. لا تعديل worktree account-nature أو Shop أو العمل المتزامن shared/worktree-dev.

الترحيل الأمامي الوحيد الجديد `20260919095839_explicit_account_groups.sql`: عمود role افتراضي posting، role ثابت، تحقق group/contra/system/category، حماية نوع/عملة الأب المستخدم، رفض group في app.require_account وفي trigger مستقل على البنود، وتوسيع create_account بمعامل اختياري أخير دون overload. update_account القديم باقٍ. عرض account_balances يضيف الدور مع الاحتفاظ بأعمدته وصلاحيات security_invoker. يتم حساب is_liquid من الدور والنوع الفرعي؛ قيم كل الحسابات الحالية محفوظة. [PostgreSQL 17 SET EXPRESSION](https://www.postgresql.org/docs/17/sql-altertable.html) يعيد كتابة العمود المحسوب، لذلك يتطلب النشر المستقبلي نافذة قفل مدروسة على accounts وتجربة الحجم؛ لا نشر هنا.

دور group غير قابل للتحويل في هذه الشريحة حتى لو لم يستخدم؛ اختيار الحساب الأب للحسابات الجديدة فقط. الآباء القديمة تبقى posting ويمكنها الاستمرار في الترحيل؛ تعرض حركتها المباشرة مرة واحدة. group لا يعرض رصيدًا تجميعيًا محسوبًا من أبنائه، بل «دون بنود مباشرة». إجمالي النوع يحتفظ بجمع جميع الحركات المباشرة. لا علاقة control أو تصنيف مؤرخ أو نقل تاريخ في هذا التغيير. حساب group يستهلك حصة حساب عادي من الحصة القائمة.

صفحة الحسابات تعيد استخدام BsDialog/BsDataTable وdirty state الحاليين. يختار المستخدم الدور والأب من نفس النوع والعملة، وتظهر الأخطاء المترجمة. useOrgAccounts يرجع posting للمصادر التشغيلية؛ فلتر leaf القديم يستبدل بالدور الصريح فلا يخفي parent posting. تمت معالجة ضيق البحث على الهاتف بإعطائه صفًا كاملًا؛ اختبار width>300 عند 390px مع صور جديدة. بيانات أسماء العملاء القائمة لا تُترجم.

| الفحص الفعلي 2026-09-19 | النتيجة وحدودها |
|---|---|
| `pnpm install --frozen-lockfile` | PASS؛ dependencies الجديدة موروثة من commit الطبيعة، لا lockfile آخر |
| `pnpm check` | PASS؛ 80 بصمة SQL تاريخية محفوظة، tokens/boundaries سليمة |
| `pnpm test` | PASS؛ 28 اختبارًا، منها مرجع Stage 1 والطبيعة والدور |
| Ledger lint/typecheck/build | PASS؛ build/typecheck بلا مفاتيح worktree يعطيان تحذير Supabase env؛ تشغيل المتصفح يحدد إعدادات محلية صريحة |
| `supabase ... test db --local` على النسخة المستقلة | PASS؛ 747 assertion في 29 ملفًا، 9s؛ منها 29 اختبارًا للدور، مع بقاء كل SQL regression السابق |
| تجربة `test-account-groups-migration.mjs` | PASS؛ 4 حسابات (منها bank parent)، 3 معاملات، 6 بنود؛ الأرصدة والتقرير المطابق محفوظة دون تغيير؛ reversal/archive ضمن العينة |
| Playwright: groups/nature/accounts/core-finance | PASS؛ 23 اختبارًا، 53.8s، retries=0، backend حقيقي مستقل؛ en/ar، narrow، رفض العبث عبر RPC، permissions، ترتيب/بحث/صفحات/تبديل نطاق، وcontext القديم |
| `db advisors --local --type security --level warn --fail-on warn` | PASS؛ no issues |
| `db lint --local --schema public,app --level warning --fail-on warning` | PASS؛ no schema errors |
| توليد types محليًا `--schema public,graphql_public` | PASS؛ مولدة من المصدر؛ إضافات الدور وRPC فقط، لا تحرير يدوي |
| الصور | 4 صور اصطناعية من تدفق فعلي على backend محلي؛ تمت معاينة الإنجليزية والعربية والنموذج والهاتف |
| محاسب/UAT/نشر | NOT_STARTED؛ لا يؤخر ذلك التنفيذ تحت AS-E02؛ ليس هذا ادعاء قبول محاسبي |

الجولة الأولى لـSQL فشلت بسبب تغيير SQLSTATE لمرجع category أجنبي، وتوقيع صلاحية RPC القديم في test، وتجهيزات test للبند المباشر وسبب adjustment. أعيد SQLSTATE/FK القديم في الميزة، وحُدث توقع توقيع RPC مع إضافة المعامل، وفُصل اختبار منع صلاحية العميل عن اختبار trigger بكتابة privileged، وأضيف السبب المطلوب. لم تُلغ assertions أو retry؛ أعيد إنشاء قاعدة الحزمة فقط ونجحت 747. المتصفح الأول اجتاز 23؛ بعد تحسين البحث أُعيد build وفحص 23 وصوره بنجاح.

قائمة hashes ونتائج الفحص والنسخة في [verification.json](../../evidence/as-s2-02a/verification.json). ملفات logs التفصيلية محلية ignored تحت `.local/review` و`.local/verification/account-groups`؛ لا بيانات عملاء أو مفاتيح مستضافة. أدلة الحزم السابقة محفوظة بتواريخها.

## إعادة التشغيل بأمان

على بيئة Ledger المعتادة المخصصة لهذا الفرع وحده يمكن استخدام أوامر المنتج الأصلية بعد migration، ثم:

```sh
pnpm check
pnpm test
pnpm --filter @building-suit/ledger-suit lint
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm db:test:ledger
pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/account-groups.spec.ts tests/e2e/account-nature.spec.ts tests/e2e/accounts-table.spec.ts tests/e2e/core-finance.spec.ts
```

**في هذا الجهاز**، 60321/60322 يخصان مهمة أخرى فلا تُستخدم أو يُعاد ضبطهما. نسخة هذه الحزمة تحت `.local/verification/account-groups` مملوكة لها وبدون project-ref أو env مستضاف. أُنشئت بنسخ config.toml/migrations/tests/templates/seed.sql فقط من Ledger؛ project_id أعلاه ومنافذ 60320–60329 استبدلت بـ63320–63329؛ قبل تجربة النقل استبعد migration الجديد، فكانت 67 migration مطابقة. يبدأ CLI الخدمات الضرورية فقط:

```sh
pnpm exec supabase --workdir .local/verification/account-groups start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
# فقط عند تاريخ ما قبل group؛ يفحص السكربت الملكية/المنافذ والبصمات أولًا:
LEDGER_GROUPS_DISPOSABLE_TEST=1 node apps/ledger-suit/scripts/test-account-groups-migration.mjs
pnpm exec supabase --workdir .local/verification/account-groups test db --local
pnpm --filter @building-suit/ledger-suit exec playwright test -c .local/playwright.groups.config.ts tests/e2e/account-groups.spec.ts tests/e2e/account-nature.spec.ts tests/e2e/accounts-table.spec.ts tests/e2e/core-finance.spec.ts
pnpm exec supabase --workdir .local/verification/account-groups stop --project-id ledger-account-groups-20260919
```

سكريبت تجربة النقل يمسح **هذه النسخة القابلة للتخلص منها فقط** في النهاية لاستعادة seed نظيف. يرفض history غير المطابق قبل الكتابة؛ لا تقم بتجاوز الحارس لتشغيله على قاعدة أخرى. النسخة الحالية بعدها 68 migration، لذا SQL/المتصفح قابلان للإعادة، وإعادة تجربة قبل/بعد تحتاج نسخة جديدة أو reset صريح ومقصود لنفس النسخة المملوكة إلى `20260919013605`.

إعداد Playwright البديل محلي ignored؛ نسخة حرفية من config المنتج مع تبديل 60321→63321 و3210→3220 وtestDir إلى `../tests/e2e` وcwd إلى app وreuseExistingServer=false. لا يغيّر guard المنتج المتعقب. الاختبارات التي ترسل RPC مباشرة تستخلص origin من استجابة التطبيق وتسمح ب60321/63321 المحليين فقط. أُثبتت ملكية container ومطابقة 68 migration وبصماتها قبل المتصفح. على checkout جديد أنشئ نسخة config بنفس هذه التعديلات؛ لا توجد dependency على مسار مطلق لجهاز المطور.

## التسليم والاستمرار

الفرع المحلي فقط؛ لا push أو PR أو merge أو نشر أو migration مستضاف. preflight 10:17:20Z أظهر أن Shop PR #6 يملك stg slot، وPR #3 للإصدار محفوظ. عند نشر مسموح ومتحقق provider-wise: parent continuation إلى الدفعة النشطة، وهذه الحزمة إلى parent؛ تحقق حي وagent:pr-check لكل PR فعلية. Supabase Automatic branching ما زال غير متحقق بهذه الهوية، فلا تستنتج الإغلاق من وجود PR آخر.

النقل المستقبلي: migrate account-nature ثم groups قبل app؛ فحص snapshot/حجم accounts ووقت lock/recovery مطلوب لبيئة الإطلاق حين يُطلب نشرها. fallback للواجهة القديمة يبقي دور group وحراس القاعدة؛ لا reverse/drop للعمود أو إعادة كتابة التاريخ.

الحزمة جاهزة للمراجعة الفنية. التالي AS-S2-01B لتصنيف العرض المؤرخ تحت AS-E02؛ حسابات المراقبة تعتمد على عقود دفاترها ولم تُدّع هنا. لا بوابة موافقة محاسب جديدة لتنفيذ الحزمة التالية.
