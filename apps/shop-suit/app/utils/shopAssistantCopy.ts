import type { BsAssistantChatCopy } from '@building-suit/ui/types/assistantChatPresentation'

export function shopAssistantTitle(isArabic: boolean) {
  return isArabic ? 'مساعد المتجر' : 'Shop assistant'
}

export function shopAssistantCopy(isArabic: boolean) {
  const title = shopAssistantTitle(isArabic)
  const chat: BsAssistantChatCopy = isArabic ? {
    title,
    transcript: 'المحادثة',
    user: 'أنت',
    assistant: title,
    receipt: 'تم التسجيل',
    emptyTitle: 'تحب تعرف إيه عن متجرك؟',
    emptyDescription: 'اسأل عن المنتجات أو المخزون أو المبيعات أو المصروفات. تقدر كمان تطلب تسجيل مصروف.',
    composer: 'رسالتك',
    placeholder: 'اكتب سؤالك أو قول عايز تعمل إيه',
    keyboardHint: 'اضغط Enter عشان تبعت، أو Shift + Enter عشان تبدأ سطر جديد.',
    privacy: 'رسايلك وبيانات المتجر المرتبطة بطلبك بتتبعت لمزوّد الذكاء الاصطناعي.',
    send: 'ابعت',
    sending: 'المساعد بيجهّز الرد…',
    newChat: 'محادثة جديدة',
    confirm: 'سجّل المصروف',
    confirming: 'بنسجّل المصروف…',
    discard: 'الغِ الطلب',
    proposalTitle: 'راجع المصروف قبل التسجيل',
    proposalHelp: 'بعد التأكيد، المصروف هيتسجّل كمدفوع وهيتضاف لإجمالي المصروفات.',
    status: {
      loading: 'بنحمّل بيانات المتجر…',
      denied: 'مساعد المتجر متاح للمالك بس.',
      unavailable: 'مساعد المتجر مش متاح دلوقتي.',
      noLocation: 'اختار فرع شغّال عشان تبدأ المحادثة.',
    },
  } : {
    title,
    transcript: 'Conversation',
    user: 'You',
    assistant: title,
    receipt: 'Recorded',
    emptyTitle: 'What would you like to do?',
    emptyDescription: 'Ask about products, stock, sales or expenses. You can also ask to record an expense.',
    composer: 'Your message',
    placeholder: 'Ask a question or describe a task',
    keyboardHint: 'Enter to send, Shift + Enter for a new line.',
    privacy: 'Your messages and relevant shop data are sent to the AI provider.',
    send: 'Send',
    sending: 'Preparing a reply…',
    newChat: 'New conversation',
    confirm: 'Record expense',
    confirming: 'Recording expense…',
    discard: 'Discard request',
    proposalTitle: 'Review expense',
    proposalHelp: 'Confirmation records a paid expense and adds it to your expense total.',
    status: {
      loading: 'Loading shop details…',
      denied: 'The Shop assistant is available to shop owners.',
      unavailable: 'The Shop assistant is currently unavailable.',
      noLocation: 'Choose an active location to start a conversation.',
    },
  }
  return {
    chat,
    fields: isArabic
      ? { shop: 'المتجر', location: 'الفرع', amount: 'المبلغ', date: 'التاريخ', category: 'التصنيف' }
      : { shop: 'Shop', location: 'Location', amount: 'Amount', date: 'Date', category: 'Category' },
    links: isArabic
      ? { products: 'افتح المنتجات', inventory: 'افتح المخزون', reports: 'افتح التقارير', expenses: 'افتح المصروفات' }
      : { products: 'Open Products', inventory: 'Open Inventory', reports: 'Open Reports', expenses: 'Open Expenses' },
    error: isArabic ? {
      message: 'مقدرناش نجيب رد. حاول تبعت رسالتك تاني.',
      confirm: 'مقدرناش نتأكد من تسجيل المصروف. حاول تأكد نفس الطلب تاني أو راجع المصروفات.',
      expired: 'انتهت صلاحية الطلب. راجع المصروفات قبل ما تطلب تسجيله تاني.',
      changed: 'بيانات المتجر اتغيّرت. اطلب تسجيل المصروف تاني عشان تراجع البيانات الجديدة.',
      access: 'مقدرناش نتحقق من صلاحيتك للفرع ده.',
      tooLong: 'الرسالة طويلة. قصّرها وحاول تاني.',
      busy: 'في طلبات كتير دلوقتي. استنى شوية وحاول تاني.',
      unavailable: 'المساعد مش متاح دلوقتي. حاول تاني بعد شوية.',
    } : {
      message: 'Could not get a reply. Try sending your message again.',
      confirm: 'Could not verify that the expense was recorded. Retry this confirmation or check Expenses.',
      expired: 'This request expired. Check Expenses before asking to record it again.',
      changed: 'Shop details changed. Ask to record the expense again so you can review the updated details.',
      access: 'Could not verify your access to this location.',
      tooLong: 'Shorten your message and try again.',
      busy: 'There are too many requests. Wait a moment and try again.',
      unavailable: 'The assistant is temporarily unavailable. Try again shortly.',
    },
    recorded: isArabic ? 'اتسجّل المصروف في الفرع ده.' : 'The expense was recorded at this location.',
  }
}
