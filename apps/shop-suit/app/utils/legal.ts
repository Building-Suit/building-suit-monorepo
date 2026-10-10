export type LegalLocale = 'en' | 'ar'

export interface LegalSection {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDocument {
  title: string
  intro: string
  updated: string
  sections: LegalSection[]
}

// Verified public identity shared with the existing Building Suit legal pages.
export const publicBusiness = {
  brand: 'Shop Suit by Building Suit',
  supportEmail: 'support@building-suit.com',
  phone: '+201500240770',
  addressEn: 'Cairo, Egypt',
  addressAr: 'القاهرة، مصر',
} as const

export const legalDocuments: Record<
  'about' | 'privacy' | 'delivery' | 'refund' | 'terms',
  Record<LegalLocale, LegalDocument>
> = {
  about: {
    en: {
      title: 'About Us',
      intro: 'Shop Suit is digital shop-management software for small businesses. Shop Suit is a product by Building Suit.',
      updated: '30 September 2026',
      sections: [
        {
          title: 'What Shop Suit does',
          paragraphs: [
            'Shop Suit provides an online workspace for managing products and services, sales, payments, expenses, inventory, locations, appointments, team access, and operational reports.',
            'The service is delivered digitally as software-as-a-service (SaaS). No physical product is supplied.',
          ],
        },
        {
          title: 'Who we serve',
          paragraphs: ['Shop Suit is designed for owner-managed shops and service businesses that need one practical place to run and review daily operations.'],
        },
        {
          title: 'Brand and operator',
          paragraphs: ['Shop Suit is a product by Building Suit. Building Suit is the parent brand and merchant identity used for the service and its payment arrangements.'],
        },
        {
          title: 'Contact',
          paragraphs: [`For questions about Shop Suit, billing, subscriptions, or support, contact ${publicBusiness.supportEmail}.`],
        },
      ],
    },
    ar: {
      title: 'من نحن',
      intro: 'Shop Suit هو برنامج رقمي لإدارة المتاجر والأنشطة الصغيرة، وهو أحد منتجات Building Suit.',
      updated: '30 سبتمبر 2026',
      sections: [
        {
          title: 'ماذا يقدم Shop Suit؟',
          paragraphs: [
            'يوفر Shop Suit مساحة عمل إلكترونية لإدارة المنتجات والخدمات والمبيعات والمدفوعات والمصروفات والمخزون والفروع والمواعيد وصلاحيات الفريق والتقارير التشغيلية.',
            'الخدمة رقمية بالكامل بنظام البرمجيات كخدمة (SaaS)، ولا يتم بيع أو شحن أي منتج مادي.',
          ],
        },
        { title: 'لمن صُمم Shop Suit؟', paragraphs: ['صُمم Shop Suit لأصحاب المتاجر والأنشطة الخدمية الصغيرة الذين يحتاجون إلى مكان عملي واحد لتشغيل أعمالهم اليومية ومراجعتها.'] },
        { title: 'العلامة التجارية والجهة المشغلة', paragraphs: ['Shop Suit هو منتج تابع لـ Building Suit، وBuilding Suit هي العلامة التجارية الأم وهوية التاجر المستخدمة في تقديم الخدمة وترتيبات الدفع.'] },
        { title: 'التواصل', paragraphs: [`للاستفسارات المتعلقة بـ Shop Suit أو الفوترة أو الاشتراكات أو الدعم، تواصل معنا عبر ${publicBusiness.supportEmail}.`] },
      ],
    },
  },
  privacy: {
    en: {
      title: 'Privacy Policy',
      intro: 'This Privacy Policy explains how Shop Suit by Building Suit collects, uses, stores, and protects information when you use our website and software service.',
      updated: '10 October 2026',
      sections: [
        {
          title: '1. Information we collect',
          bullets: [
            'Account information, such as your name, email address, authentication information, and business details.',
            'Operational information entered by you or authorized team members, including shops, locations, customers, vendors, products, services, sales, payments, expenses, inventory, appointments, and related records.',
            'Subscription and billing metadata, including plan details, transfer notices, transfer references, payment status, and operator review records.',
            'Technical and security information needed to operate and protect the service, such as device/browser information, request metadata, logs, and security events.',
            'Support requests, including reply email, category, subject, message, consent, and related account context where available; notification and delivery-status records.',
          ],
        },
        {
          title: '2. How we use information',
          bullets: [
            'To create and operate your Shop Suit account and shop workspace.',
            'To provide shop operations, reporting, collaboration, subscription, and support functionality.',
            'To manage authentication sessions and refresh authorized workspace data using shop/location-scoped change signals. Session identifiers and account/workspace context are used to scope subscriptions and clear local workspace state when the session ends.',
            'To review payment notices, activate approved subscription access, and maintain billing records.',
            'To secure the service, prevent abuse, investigate incidents, and maintain auditability.',
            'To improve reliability, usability, and performance and comply with applicable obligations.',
          ],
        },
        {
          title: '3. Payments',
          paragraphs: [
            'Shop Suit currently uses operator-configured InstaPay or instant bank transfer instructions. A transfer notice is reviewed manually by an authorized platform operator; submitting it does not automatically verify payment or activate access.',
            'Shop Suit stores the billing and transfer-reference information needed to review and audit your subscription request. Shop Suit does not claim to provide automated card processing or automated bank verification.',
          ],
        },
        {
          title: '4. Service providers',
          paragraphs: ['The contact form records your request before email delivery. The support notification uses Resend to send your reply email, subject, message, category, priority, and request reference to our support mailbox. We retain the notification payload, provider message identifier, and delivery status for delivery tracking and retries. Recording a request does not guarantee email delivery or a response time.', 'We use service providers for infrastructure, database and authentication, email delivery, and monitoring. They process information only as needed to provide their services and under their own security and privacy obligations.'],
        },
        {
          title: '5. Security and retention',
          paragraphs: [
            'We use reasonable technical and organizational measures designed to protect information. No internet service can guarantee absolute security, so users must also protect their credentials and devices.',
            'We retain information as needed to provide the service, protect its integrity, maintain legitimate business and audit records, resolve disputes, and meet applicable legal requirements. Retention periods may vary by data category.',
          ],
        },
        {
          title: '6. Your choices and rights',
          paragraphs: [
            'Subject to applicable law and the nature of the data, you may ask to access, correct, update, export, restrict, or delete personal information associated with your account. Some records may need to be retained for security, billing, audit, legal, or dispute-resolution purposes.',
            `To make a privacy request, contact ${publicBusiness.supportEmail}.`,
          ],
        },
        { title: '7. Children', paragraphs: ['Shop Suit is business software and is not intended for children.'] },
        { title: '8. Policy changes', paragraphs: ['We may update this policy when the service, providers, or applicable requirements change. The current version and its update date will remain available on this page.'] },
        { title: '9. Contact', paragraphs: [`${publicBusiness.brand} — ${publicBusiness.addressEn}. Email: ${publicBusiness.supportEmail}.`] },
      ],
    },
    ar: {
      title: 'سياسة الخصوصية',
      intro: 'توضح هذه السياسة كيفية جمع واستخدام وحفظ وحماية المعلومات عند استخدام موقع وخدمة Shop Suit by Building Suit.',
      updated: '10 أكتوبر 2026',
      sections: [
        {
          title: '1. المعلومات التي نجمعها',
          bullets: [
            'بيانات الحساب مثل الاسم والبريد الإلكتروني وبيانات تسجيل الدخول وبيانات النشاط.',
            'بيانات التشغيل التي تدخلها أنت أو أعضاء الفريق المصرح لهم، ومنها المتاجر والفروع والعملاء والموردون والمنتجات والخدمات والمبيعات والمدفوعات والمصروفات والمخزون والمواعيد والسجلات المرتبطة بها.',
            'بيانات الاشتراك والفوترة، ومنها تفاصيل الخطة وإشعارات التحويل ومراجع التحويل وحالة الدفع وسجلات مراجعة المسؤول.',
            'البيانات التقنية والأمنية اللازمة لتشغيل الخدمة وحمايتها، مثل بيانات الجهاز والمتصفح والطلبات والسجلات والأحداث الأمنية.',
            'طلبات الدعم، ومنها بريد الرد والتصنيف والموضوع والرسالة والموافقة وسياق الحساب المرتبط عند توفره؛ وسجلات الإشعارات وحالة التسليم.',
          ],
        },
        {
          title: '2. كيفية استخدام المعلومات',
          bullets: [
            'إنشاء وتشغيل حساب Shop Suit ومساحة عمل متجرك.',
            'تقديم وظائف تشغيل المتجر والتقارير والتعاون والاشتراكات والدعم.',
            'إدارة جلسات تسجيل الدخول وتحديث بيانات مساحة العمل المصرح بها باستخدام إشارات تغيير خاصة بالمتجر والفرع. تُستخدم معرّفات الجلسات وسياق الحساب ومساحة العمل لتحديد نطاق اشتراكات التحديث ومسح حالة مساحة العمل المحلية عند انتهاء الجلسة.',
            'مراجعة إشعارات الدفع وتفعيل الوصول المعتمد والاحتفاظ بسجلات الفوترة.',
            'حماية الخدمة ومنع إساءة الاستخدام والتحقيق في الحوادث والحفاظ على سجلات المراجعة.',
            'تحسين الاعتمادية وسهولة الاستخدام والأداء والوفاء بالالتزامات المطبقة.',
          ],
        },
        {
          title: '3. المدفوعات',
          paragraphs: [
            'يستخدم Shop Suit حاليًا تعليمات InstaPay أو التحويل البنكي الفوري التي يضبطها مسؤول المنصة. يراجع مسؤول مخوّل إشعار التحويل يدويًا، ولا يؤدي إرساله إلى التحقق التلقائي من الدفع أو تفعيل الوصول.',
            'يحتفظ Shop Suit ببيانات الفوترة ومرجع التحويل اللازمة لمراجعة طلب الاشتراك وتدقيقه، ولا يدّعي توفير معالجة آلية للبطاقات أو تحقق بنكي تلقائي.',
          ],
        },
        { title: '4. مزودو الخدمة', paragraphs: ['يسجل نموذج التواصل طلبك قبل تسليم البريد. يستخدم إشعار الدعم Resend لإرسال بريد الرد والموضوع والرسالة والتصنيف والأولوية ومرجع الطلب إلى بريد الدعم. نحتفظ بمحتوى الإشعار ومعرّف الرسالة لدى المزود وحالة التسليم لمتابعة التسليم وإعادة المحاولة. لا يضمن تسجيل الطلب تسليم البريد أو مدة محددة للرد.', 'نستخدم مزودي خدمات للبنية التحتية وقواعد البيانات وتسجيل الدخول وإرسال البريد الإلكتروني والمراقبة. وتتم معالجة المعلومات بالقدر اللازم لتقديم تلك الخدمات ووفق التزامات الأمان والخصوصية الخاصة بهم.'] },
        {
          title: '5. الأمان والاحتفاظ',
          paragraphs: [
            'نستخدم إجراءات تقنية وتنظيمية معقولة لحماية المعلومات. ولا يمكن لأي خدمة عبر الإنترنت ضمان الأمان المطلق، لذلك يجب على المستخدم أيضًا حماية بيانات الدخول والأجهزة.',
            'نحتفظ بالمعلومات بالقدر اللازم لتقديم الخدمة وحماية سلامتها والاحتفاظ بسجلات الأعمال والمراجعة المشروعة وحل النزاعات والوفاء بالمتطلبات القانونية المطبقة. وقد تختلف المدة حسب نوع البيانات.',
          ],
        },
        {
          title: '6. اختياراتك وحقوقك',
          paragraphs: [
            'وفقًا للقانون المطبق وطبيعة البيانات، يمكنك طلب الوصول إلى بياناتك الشخصية أو تصحيحها أو تحديثها أو تصديرها أو تقييدها أو حذفها. وقد يلزم الاحتفاظ ببعض السجلات لأسباب أمنية أو متعلقة بالفوترة أو المراجعة أو الالتزامات القانونية أو النزاعات.',
            `لطلب إجراء متعلق بالخصوصية، تواصل معنا عبر ${publicBusiness.supportEmail}.`,
          ],
        },
        { title: '7. الأطفال', paragraphs: ['Shop Suit برنامج مخصص للأعمال وليس موجهًا للأطفال.'] },
        { title: '8. تحديثات السياسة', paragraphs: ['قد نحدّث هذه السياسة عند تغير الخدمة أو مزوديها أو المتطلبات المطبقة، وستظل النسخة الحالية وتاريخ تحديثها متاحين في هذه الصفحة.'] },
        { title: '9. التواصل', paragraphs: [`${publicBusiness.brand} — ${publicBusiness.addressAr}. البريد الإلكتروني: ${publicBusiness.supportEmail}.`] },
      ],
    },
  },
  delivery: {
    en: {
      title: 'Delivery & Shipping Policy',
      intro: 'Shop Suit is a digital software-as-a-service product. We do not sell or ship physical goods.',
      updated: '30 September 2026',
      sections: [
        { title: 'Digital delivery', paragraphs: ['Shop Suit is delivered electronically through your online account and shop workspace. There is no courier, physical shipment, or shipping fee.'] },
        {
          title: 'When access is provided',
          paragraphs: [
            'Eligible new accounts receive the trial shown during signup.',
            'For paid access, the Shop owner submits an InstaPay or instant-bank-transfer notice. Access changes only after an authorized operator reviews the transfer externally and approves the request. Submission alone is not payment confirmation.',
          ],
        },
        { title: 'Activation delays', paragraphs: ['Manual review, incomplete or unmatched transfer details, security checks, service interruption, or a technical error may delay activation. If you transferred funds but paid access is unavailable, contact support with the account email and transfer reference.'] },
        { title: 'No physical delivery', paragraphs: ['Because Shop Suit is a digital service, there is no physical delivery location or shipping process. Online access remains subject to account eligibility, service availability, and applicable law.'] },
        { title: 'Support', paragraphs: [`For digital-delivery or activation questions, contact ${publicBusiness.supportEmail}.`] },
      ],
    },
    ar: {
      title: 'سياسة التسليم والشحن',
      intro: 'Shop Suit منتج برمجي رقمي بنظام البرمجيات كخدمة (SaaS)، ولا نبيع أو نشحن منتجات مادية.',
      updated: '30 سبتمبر 2026',
      sections: [
        { title: 'التسليم الرقمي', paragraphs: ['يتم تقديم Shop Suit إلكترونيًا من خلال حسابك ومساحة عمل متجرك، ولا يوجد شحن مادي أو شركة توصيل أو رسوم شحن.'] },
        {
          title: 'موعد تفعيل الوصول',
          paragraphs: [
            'تحصل الحسابات الجديدة المؤهلة على الفترة التجريبية الموضحة أثناء التسجيل.',
            'للوصول المدفوع، يرسل مالك المتجر إشعار تحويل عبر InstaPay أو التحويل البنكي الفوري. لا يتغير الوصول إلا بعد مراجعة مسؤول مخوّل للتحويل خارجيًا واعتماد الطلب، ولا يُعد إرسال الإشعار وحده تأكيدًا للدفع.',
          ],
        },
        { title: 'تأخر التفعيل', paragraphs: ['قد تتأخر عملية التفعيل بسبب المراجعة اليدوية أو نقص بيانات التحويل أو عدم تطابقها أو فحوص الأمان أو توقف الخدمة أو خطأ تقني. إذا حولت المبلغ ولم يتوفر الوصول المدفوع، فتواصل مع الدعم وأرفق بريد الحساب ومرجع التحويل.'] },
        { title: 'لا يوجد تسليم مادي', paragraphs: ['لأن Shop Suit خدمة رقمية، فلا يوجد عنوان تسليم أو شحن مادي. يظل الوصول عبر الإنترنت خاضعًا لأهلية الحساب وتوفر الخدمة والقانون المطبق.'] },
        { title: 'الدعم', paragraphs: [`للاستفسار عن التسليم الرقمي أو التفعيل، تواصل معنا عبر ${publicBusiness.supportEmail}.`] },
      ],
    },
  },
  refund: {
    en: {
      title: 'Refund & Cancellation Policy',
      intro: 'This policy explains how cancellation and refund requests are handled for Shop Suit subscriptions paid through the current manual InstaPay or instant-transfer process.',
      updated: '30 September 2026',
      sections: [
        { title: 'Cancellation', paragraphs: ['You may ask us to cancel future paid access by contacting support. Shop Suit does not claim an automated card-renewal or self-service payment cancellation flow. Cancellation does not delete your business records; access and retention remain subject to the Terms & Conditions.'] },
        { title: 'Manual payment review', paragraphs: ['Submitting a payment notice does not activate a plan. An authorized operator must review the external InstaPay or instant-transfer record before approval. If the notice is rejected, your current access remains unchanged and the review reason may be shown in Shop Suit.'] },
        {
          title: 'Refund requests',
          paragraphs: [
            'Refund requests are reviewed by an operator against the transfer record, account history, service delivery, these terms, and applicable law. Sending a request does not guarantee eligibility or approval.',
            'Do not submit a second transfer to correct an unmatched notice unless support asks you to do so. Contact support with the account email, transfer date, amount, and reference.',
          ],
        },
        { title: 'Processing', paragraphs: ['Approved refunds are handled through an available method determined during the operator review. Timing can depend on the transfer channel and information required to complete the review; no automatic refund or fixed processing time is promised.'] },
        { title: 'Contact', paragraphs: [`Send cancellation or refund requests to ${publicBusiness.supportEmail}.`] },
      ],
    },
    ar: {
      title: 'سياسة الاسترداد والإلغاء',
      intro: 'توضح هذه السياسة كيفية التعامل مع طلبات إلغاء اشتراكات Shop Suit واسترداد المدفوعات المسددة من خلال عملية InstaPay أو التحويل الفوري اليدوية الحالية.',
      updated: '30 سبتمبر 2026',
      sections: [
        { title: 'الإلغاء', paragraphs: ['يمكنك طلب إلغاء الوصول المدفوع مستقبلًا بالتواصل مع الدعم. لا يدّعي Shop Suit وجود تجديد بطاقات آلي أو إلغاء دفع ذاتي. ولا يؤدي الإلغاء إلى حذف سجلات نشاطك؛ إذ يظل الوصول والاحتفاظ خاضعين للشروط والأحكام.'] },
        { title: 'مراجعة الدفع اليدوية', paragraphs: ['لا يؤدي إرسال إشعار الدفع إلى تفعيل الخطة. يجب أن يراجع مسؤول مخوّل سجل InstaPay أو التحويل الفوري الخارجي قبل الاعتماد. إذا رُفض الإشعار، يظل وصولك الحالي دون تغيير وقد يظهر سبب المراجعة داخل Shop Suit.'] },
        {
          title: 'طلبات الاسترداد',
          paragraphs: [
            'يراجع المسؤول طلب الاسترداد بالرجوع إلى سجل التحويل وسجل الحساب وتقديم الخدمة وهذه الشروط والقانون المطبق. ولا يضمن إرسال الطلب استحقاق الاسترداد أو اعتماده.',
            'لا ترسل تحويلًا ثانيًا لتصحيح إشعار غير مطابق إلا إذا طلب منك الدعم ذلك. تواصل مع الدعم وأرفق بريد الحساب وتاريخ التحويل والمبلغ والمرجع.',
          ],
        },
        { title: 'المعالجة', paragraphs: ['تُنفذ المبالغ المستردة المعتمدة من خلال وسيلة متاحة تُحدد أثناء مراجعة المسؤول. وقد يعتمد الوقت على قناة التحويل والمعلومات المطلوبة لإكمال المراجعة؛ ولا نعد باسترداد تلقائي أو مدة معالجة ثابتة.'] },
        { title: 'التواصل', paragraphs: [`أرسل طلبات الإلغاء أو الاسترداد إلى ${publicBusiness.supportEmail}.`] },
      ],
    },
  },
  terms: {
    en: {
      title: 'Terms & Conditions',
      intro: 'These Terms & Conditions govern access to and use of Shop Suit by Building Suit.',
      updated: '10 October 2026',
      sections: [
        { title: '1. The service', paragraphs: ['Shop Suit is a hosted business-operations service. Features and limits depend on the active plan, account eligibility, and the capabilities made available in the product.'] },
        { title: '2. Accounts and authority', bullets: ['Provide accurate account and business information.', 'Protect credentials and use team permissions appropriately.', 'Only enter or manage information that you are authorized to use.', 'The Shop owner is responsible for authorized team access and activity in the workspace.', 'Team members use their own accounts and accept invitations. Team actions depend on assigned permissions and locations; delegated administrators cannot grant permissions they do not hold.', 'Each user account is intended for one active device/session at a time. Provider enforcement is not currently verified as enabled; where enabled, the newest sign-in takes precedence at session refresh, and already-issued access tokens may remain valid until expiry. This is not an instant-revocation or credential-sharing prevention guarantee. Normal logout ends only the current session.'] },
        { title: '3. Customer records', paragraphs: ['You control the business records entered into your workspace and are responsible for their accuracy, legality, and necessary notices or permissions. Shop Suit supports operations and reports but does not replace professional legal, tax, or accounting advice.'] },
        {
          title: '4. Trials, plans, and payment',
          paragraphs: [
            'New eligible accounts receive the trial described at signup. Plan availability, limits, price, currency, and subscription interval are shown before a payment notice is submitted.',
            'Current public plans are Solo (1 or 2 members), Team (8 members), and Multi (16 members for 2 branches or 25 members for 3 branches). Member limits include the owner; unexpired pending invitations reserve capacity. The selected catalog terms govern the price, interval, and resource limits; existing subscriptions retain their agreed terms. Plan changes can be blocked by usage above the selected limits and do not automatically delete or archive business records.',
            'Current payments use operator-configured InstaPay or instant-transfer instructions. A notice starts manual review only. Paid access begins or changes only after an authorized operator verifies the external transfer and approves the request.',
          ],
        },
        { title: '5. Acceptable use', bullets: ['Do not use the service unlawfully or to infringe another person’s rights.', 'Do not attempt unauthorized access, security testing, interference, or abusive automation.', 'Do not upload malicious code or content you are not authorized to process.', 'Do not misrepresent payment, identity, or business information.'] },
        { title: '6. Availability and changes', paragraphs: ['We work to provide a reliable service but do not promise uninterrupted or error-free availability. We may maintain, secure, or change the service and will update applicable information when material terms change.'] },
        { title: '7. Cancellation, refunds, and records', paragraphs: ['Cancellation and refund requests follow the Refund & Cancellation Policy and applicable law. Subscription expiry or cancellation may restrict new operations while preserving authorized access to existing records. Records may be retained where needed for security, audit, billing, legal, or dispute-resolution purposes.'] },
        { title: '8. Responsibility', paragraphs: ['To the extent permitted by applicable law, you remain responsible for business decisions, source data, devices, credentials, and use of exported information. Nothing in these terms excludes rights or liability that cannot lawfully be excluded.'] },
        { title: '9. Contact', paragraphs: [`Questions about these terms may be sent to ${publicBusiness.supportEmail}. ${publicBusiness.brand} is based in ${publicBusiness.addressEn}.`] },
      ],
    },
    ar: {
      title: 'الشروط والأحكام',
      intro: 'تحكم هذه الشروط والأحكام الوصول إلى Shop Suit by Building Suit واستخدامه.',
      updated: '10 أكتوبر 2026',
      sections: [
        { title: '1. الخدمة', paragraphs: ['Shop Suit خدمة مستضافة لإدارة عمليات النشاط. تعتمد المميزات والحدود على الخطة النشطة وأهلية الحساب والقدرات المتاحة داخل المنتج.'] },
        { title: '2. الحسابات والصلاحيات', bullets: ['قدّم بيانات حساب ونشاط دقيقة.', 'احمِ بيانات الدخول واستخدم صلاحيات الفريق بطريقة مناسبة.', 'لا تدخل أو تدير إلا المعلومات المصرح لك باستخدامها.', 'يتحمل مالك المتجر مسؤولية وصول أعضاء الفريق المصرح لهم ونشاطهم داخل مساحة العمل.', 'يستخدم أعضاء الفريق حساباتهم الخاصة ويقبلون الدعوات. تعتمد إجراءات الفريق على الصلاحيات والفروع المسندة، ولا يمكن للمسؤول المفوّض منح صلاحيات لا يملكها.', 'كل حساب مستخدم مخصص لجهاز أو جلسة نشطة واحدة في الوقت نفسه. لم يتم التحقق حاليًا من تفعيل هذا القيد لدى مزود تسجيل الدخول؛ وعند تفعيله تكون الأولوية لأحدث تسجيل دخول عند تحديث الجلسة، وقد تظل رموز الوصول الصادرة صالحة حتى انتهاء مدتها. لا يعني ذلك ضمان الإلغاء الفوري أو منع مشاركة بيانات الدخول. ينهي تسجيل الخروج العادي الجلسة الحالية فقط.'] },
        { title: '3. سجلات العميل', paragraphs: ['أنت تتحكم في سجلات النشاط التي تدخلها إلى مساحة العمل وتتحمل مسؤولية دقتها ومشروعيتها وتقديم الإشعارات أو الحصول على الموافقات اللازمة. يساعد Shop Suit في العمليات والتقارير لكنه لا يحل محل الاستشارة القانونية أو الضريبية أو المحاسبية المتخصصة.'] },
        {
          title: '4. التجربة والخطط والدفع',
          paragraphs: [
            'تحصل الحسابات الجديدة المؤهلة على الفترة التجريبية الموضحة أثناء التسجيل. وتظهر الخطط المتاحة وحدودها وسعرها وعملتها ومدة الاشتراك قبل إرسال إشعار الدفع.',
            'الخطط العامة الحالية هي Solo (عضو واحد أو عضوان)، وTeam (8 أعضاء)، وMulti (16 عضوًا لفرعين أو 25 عضوًا لثلاثة فروع). تشمل حدود الأعضاء المالك، وتحجز الدعوات المعلقة غير المنتهية سعة ضمن الحد. تحكم شروط الكتالوج المختارة السعر والمدة وحدود الموارد، وتحتفظ الاشتراكات القائمة بشروطها المتفق عليها. قد يُمنع تغيير الخطة إذا تجاوز الاستخدام حدود الخطة المختارة، ولا يؤدي تغييرها إلى حذف سجلات النشاط أو أرشفتها تلقائيًا.',
            'تستخدم المدفوعات الحالية تعليمات InstaPay أو التحويل الفوري التي يضبطها مسؤول المنصة. يبدأ الإشعار المراجعة اليدوية فقط، ولا يبدأ الوصول المدفوع أو يتغير إلا بعد تحقق مسؤول مخوّل من التحويل الخارجي واعتماد الطلب.',
          ],
        },
        { title: '5. الاستخدام المقبول', bullets: ['لا تستخدم الخدمة بشكل غير قانوني أو لانتهاك حقوق الآخرين.', 'لا تحاول الوصول غير المصرح به أو اختبار الأمان أو تعطيل الخدمة أو تشغيل أدوات آلية مسيئة.', 'لا ترفع برمجيات ضارة أو محتوى غير مصرح لك بمعالجته.', 'لا تقدم معلومات مضللة عن الدفع أو الهوية أو النشاط.'] },
        { title: '6. التوفر والتغييرات', paragraphs: ['نعمل على تقديم خدمة موثوقة، لكننا لا نعد بتوفر مستمر أو خالٍ من الأخطاء. وقد نجري أعمال صيانة أو حماية أو تغييرات على الخدمة، ونحدّث المعلومات المطبقة عند تغير الشروط الجوهرية.'] },
        { title: '7. الإلغاء والاسترداد والسجلات', paragraphs: ['تخضع طلبات الإلغاء والاسترداد لسياسة الاسترداد والإلغاء والقانون المطبق. وقد يؤدي انتهاء الاشتراك أو إلغاؤه إلى تقييد العمليات الجديدة مع الحفاظ على الوصول المصرح به للسجلات القائمة. وقد نحتفظ بسجلات لازمة للأمان أو المراجعة أو الفوترة أو الالتزامات القانونية أو حل النزاعات.'] },
        { title: '8. المسؤولية', paragraphs: ['في الحدود التي يسمح بها القانون المطبق، تظل مسؤولًا عن قرارات النشاط والبيانات الأصلية والأجهزة وبيانات الدخول واستخدام المعلومات المصدرة. ولا تستبعد هذه الشروط أي حقوق أو مسؤوليات لا يجوز قانونًا استبعادها.'] },
        { title: '9. التواصل', paragraphs: [`يمكن إرسال الأسئلة عن هذه الشروط إلى ${publicBusiness.supportEmail}. يقع مقر ${publicBusiness.brand} في ${publicBusiness.addressAr}.`] },
      ],
    },
  },
}
