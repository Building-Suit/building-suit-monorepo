export function doctorPublicPreview(arabic: boolean) {
  return arabic ? {
    productName: 'Doctor Suit', eyebrow: 'معاينة تجريبية فقط',
    title: 'ممارستك الطبية معك أينما عملت',
    description: 'الطبيب هو مالك الممارسة. يجري تطوير مساحة إدارية مستقلة للطبيب مع تفويض واضح للسكرتير في كل موقع.',
    notice: 'هذه معاينة ببيانات تجريبية فقط. لا تستقبل مرضى حقيقيين ولا تقدم رعاية سريرية أو خدمة دفع.',
    featuresTitle: 'نطاق التطوير',
    features: [
      { id: 'ownership', title: 'ملكية الطبيب عبر المواقع', description: 'مخطط: ممارسة واحدة للطبيب مع مواقع عمل متعددة، دون نقل ملكية السجل إلى الموقع.', status: 'مخطط' },
      { id: 'delegation', title: 'تفويض إداري واضح', description: 'مخطط: عضويات مستقلة للسكرتير لدى أكثر من طبيب، بصلاحيات ومواقع محددة.', status: 'مخطط' },
      { id: 'appointments', title: 'المواعيد والاستقبال', description: 'مخطط: دليل المرضى الإداري والمواعيد وقائمة الانتظار ضمن نطاق الصلاحيات.', status: 'مخطط' },
    ],
    workflowTitle: 'رحلة العمل المخططة',
    workflow: [
      { id: 'alone', title: 'ابدأ كطبيب مستقل', description: 'أنشئ الممارسة وموقعها الأول بنفسك؛ وجود سكرتير ليس شرطاً.' },
      { id: 'locations', title: 'أضف مواقع العمل', description: 'احتفظ بملكية الممارسة مع توثيق موقع كل موعد ومنع التعارض بين المواقع.' },
      { id: 'staff', title: 'فوّض عند الحاجة', description: 'ادعُ السكرتير وحدد الصلاحيات لكل ممارسة وموقع. لا تمنح الصلاحيات الإدارية سلطة توقيع سريري.' },
    ],
    actionLabel: 'عرض نطاق المعاينة',
    scopeNotice: 'نطاق المعاينة: الإدارة عبر المتصفح أولاً. الإجراءات السريرية والدفع وتطبيقات الهاتف غير متاحة حالياً. وصول المرضى واستمرارية سجلهم عبر التطبيقات مخططان لمراحل لاحقة وفق صلاحيات مشاركة مستقلة.',
    previewLink: { label: 'تفاصيل المعاينة', to: '/preview' },
  } : {
    productName: 'Doctor Suit', eyebrow: 'Synthetic preview only',
    title: 'Your practice, wherever you work',
    description: 'The doctor owns the practice. An independent administrative workspace with explicit secretary delegation at each location is being built.',
    notice: 'This preview uses synthetic data only. It does not accept real patients or provide clinical care or payment services.',
    featuresTitle: 'Development scope',
    features: [
      { id: 'ownership', title: 'Doctor ownership across locations', description: 'Planned: one doctor-owned practice across multiple working locations, without making the location the chart owner.', status: 'Planned' },
      { id: 'delegation', title: 'Explicit administrative delegation', description: 'Planned: independent secretary memberships with several doctors, with selected capabilities and location grants.', status: 'Planned' },
      { id: 'appointments', title: 'Appointments and reception', description: 'Planned: an administrative patient directory, appointments and waiting queue within authorized scopes.', status: 'Planned' },
    ],
    workflowTitle: 'Planned workflow',
    workflow: [
      { id: 'alone', title: 'Start independently', description: 'Create your practice and initial location yourself. A secretary is optional.' },
      { id: 'locations', title: 'Add working locations', description: 'Keep ownership of the practice while recording appointment locations and preventing commitments that overlap across locations.' },
      { id: 'staff', title: 'Delegate when needed', description: 'Invite a secretary and grant permissions independently for each practice and location. Administrative grants never confer clinical signing authority.' },
    ],
    actionLabel: 'View preview scope',
    scopeNotice: 'Preview scope: administrative web first. Clinical workflows, payment and mobile applications remain unavailable. Patient access and continuity across applications are planned for later milestones with independent sharing permissions.',
    previewLink: { label: 'Preview details', to: '/preview' },
  }
}
