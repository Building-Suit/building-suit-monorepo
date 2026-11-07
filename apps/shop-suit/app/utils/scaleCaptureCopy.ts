import type { BsScaleCaptureCopy } from '@building-suit/ui/types/scaleCapturePresentation'
export function scaleCaptureCopy(ar: boolean, retry = false): BsScaleCaptureCopy {
 return ar ? { title:'وزن الصنف',open:'وزن صنف',device:'الميزان المعتمد',product:'الصنف',connect:'توصيل الميزان',disconnect:'فصل الميزان',read:'قراءة وزن ثابت',tare:'تصفير وزن الوعاء',confirm:retry?'إعادة نفس الطلب':'تأكيد الوزن وإضافة للبيع',close:'إغلاق',retry:'إعادة المحاولة',more:'تحميل المزيد',loading:'جارٍ تحميل الخيارات',status:'الاتصال',net:'الصافي',tareWeight:'وزن الوعاء',gross:'الإجمالي على الميزان',stockQuantity:'كمية المخزون',factor:'معامل التحويل المعتمد',setup:'إعداد الموازين والمعاملات',source:'مرجع الاعتماد' }
 : { title:'Weigh item',open:'Weigh an item',device:'Approved scale',product:'Product',connect:'Connect scale',disconnect:'Disconnect scale',read:'Read stable weight',tare:'Tare container',confirm:retry?'Retry same request':'Confirm weight and add to sale',close:'Close',retry:'Retry',more:'Load more',loading:'Loading choices',status:'Connection',net:'Net',tareWeight:'Tare',gross:'Gross on scale',stockQuantity:'Stock quantity',factor:'Approved conversion factor',setup:'Scale and conversion setup',source:'Approval reference' }
}
export function scaleFailure(cause: unknown, ar: boolean): string {
 const message = (cause as { message?: string })?.message || ''
 if (message.includes('SHOP_PERMISSION_DENIED')) return ar?'اطلب من المالك صلاحية استخدام الميزان لهذا الفرع.':'Ask the owner for permission to use the scale at this location.'
 if (message.includes('SCALE_BROWSER_UNSUPPORTED')) return ar?'هذا المتصفح لا يدعم توصيل الميزان. يمكنك إدخال الكمية المقاسة يدويًا.':'This browser cannot connect to the scale. You can enter the measured quantity manually.'
 if (message.includes('SCALE_CLOSE_FAILED')) return ar?'تعذّر إغلاق اتصال الميزان. أعد تحميل الصفحة قبل توصيله مجددًا؛ البيع اليدوي متاح.':'The scale connection could not close. Reload before reconnecting; manual sales remain available.'
 if (message.includes('APPROVED_MASS_LENGTH') || message.includes('UNREPRESENTABLE') || message.includes('MEASUREMENT_INCREMENT')) return ar?'راجع معامل الصنف المعتمد ودقة كمية المخزون قبل تأكيد الوزن.':'Review the approved product factor and stock quantity precision before confirming the weight.'
 if (message.includes('SCALE_READING_EXPIRED')) return ar?'انتهت صلاحية القراءة. اقرأ وزنًا ثابتًا مجددًا.':'The reading expired. Read a stable weight again.'
 if (message.includes('SCALE_UNSTABLE') || message.includes('SCALE_NOT_READY')) return ar?'انتظر ثبات الميزان ثم أعد القراءة.':'Wait for the scale to stabilize, then read again.'
 if (message.includes('SCALE_OVERLOAD') || message.includes('SCALE_UNDERLOAD')) return ar?'راجع الحمل وموضع الكفة ثم أعد القراءة.':'Check the load and weighing pan, then read again.'
 if (message.includes('SCALE_TARE') || message.includes('SCALE_UNIT_CHANGED')) return ar?'تغير وزن الوعاء أو الوحدة. أعد التوصيل والقراءة.':'The tare or unit changed. Reconnect and read again.'
 if (message.includes('CONTEXT_CHANGED') || message.includes('SCALE_IDENTITY')) return ar?'تغير اعتماد الميزان أو هويته. حدّث الخيارات وأعد التوصيل والوزن.':'The scale approval or identity changed. Refresh the choices, reconnect and weigh again.'
 if (message.includes('INSUFFICIENT_STOCK')) return ar?'الوزن يتجاوز المخزون المتاح. راجع رصيد الصنف أو الكمية.':'The weight exceeds available stock. Review the product balance or quantity.'
 if (message.includes('SHOP_SUBSCRIPTION_INACTIVE')) return ar?'يلزم اشتراك نشط لحفظ قراءة جديدة. يظل السجل متاحًا.':'An active subscription is required to save a new reading. Existing history remains available.'
 if (message.includes('PGRST202') || message.includes('OFFLINE')) return ar?'اتصل بالخدمة لتأكيد الوزن، أو أدخل الكمية يدويًا.':'Connect to the service to confirm weight, or enter the quantity manually.'
 return ar?'تعذّر التحقق من قراءة الميزان. راجع الاتصال والخيارات ثم أعد المحاولة.':'Could not verify the scale reading. Review the connection and choices, then retry.'
}
