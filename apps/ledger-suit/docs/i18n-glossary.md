# Ledger Suit bilingual terminology glossary

This glossary is the source of truth for reviewed Ledger Suit product copy. Product UI translations use the same concept and register in both locales; brand names, currency codes, file formats, and technical identifiers remain unchanged.

| Concept | English | العربية |
| --- | --- | --- |
| Account | Account | حساب |
| Chart of accounts | Chart of accounts | دليل الحسابات |
| Journal entry | Journal entry | قيد يومي |
| Journal number | Journal number | رقم القيد |
| Ledger | Ledger | دفتر الأستاذ |
| Debit / Credit | Debit / Credit | مدين / دائن |
| Trial balance | Trial balance | ميزان المراجعة |
| Opening balance | Opening balance | رصيد افتتاحي |
| Fiscal period | Fiscal period | فترة مالية |
| Receivable / Payable | Receivable / Payable | ذمم مدينة / ذمم دائنة |
| Counterparty | Counterparty | طرف مقابل |
| Migration | Migration | تحويل البيانات |
| Source / target | Source / target | المصدر / الهدف |
| Review / approval | Review / approval | مراجعة / اعتماد |
| Billing | Billing | الفوترة |
| Payment | Payment | الدفع |
| Subscription | Subscription | الاشتراك |
| Plan | Plan | الخطة |
| Trial | Trial | الفترة التجريبية |
| Upgrade / downgrade | Upgrade / downgrade | ترقية / خفض الخطة |
| Organization | Organization | المنشأة |
| Member / invitation | Member / invitation | عضو / دعوة |
| Role / permission | Role / permission | دور / صلاحية |
| Support | Support | الدعم |
| Error | Error | خطأ |
| Pending / completed / failed | Pending / completed / failed | قيد الانتظار / مكتمل / فشل |
| Archived / read-only | Archived / read-only | مؤرشف / للقراءة فقط |

## RTL and mixed-direction rules

- Account codes, journal numbers, dates, amounts, currency codes, CSV/JSON/PDF identifiers, and provider names retain their source spelling and an LTR run (`dir="ltr"` or `<bdi dir="ltr">`) when embedded in Arabic copy.
- Debit and Credit are semantic labels, not visual left/right positions. Arabic copy must continue to say **مدين / دائن** even when the table mirrors.
- Money is formatted from integer minor units using the active locale, while the rendered amount remains one LTR run so signs, decimals, and currency symbols cannot reorder.
- Plan names, prices, billing intervals, payment instructions, and support wording must describe the same commercial offer in both locales.
