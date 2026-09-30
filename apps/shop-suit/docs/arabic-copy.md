# Owner-facing Arabic convention

Shop Suit speaks to Egyptian shop owners in clear, natural Egyptian Arabic. The English copy remains the meaning reference, but Arabic should sound like a helpful person explaining the next action, not like translated software or an accounting textbook.

## Voice

- Use familiar Egyptian verbs in instructions, buttons, help, empty states, and errors: `اكتب`، `اختار`، `شوف`، `ابعت`، `حاول تاني`، `مفيش`، and `مقدرناش`.
- Address the user directly and say what happened and what they can do next. Prefer `مقدرناش نحفظ المصروف. راجع البيانات وحاول تاني.` over `تعذّر حفظ المصروف.`
- Keep buttons and field labels short enough for phone layouts. Put consequences and explanations in nearby help or confirmation copy rather than in the button.
- Keep the same meaning as English. Egyptian Arabic changes the voice, not the business rule.

## Precise terms

Do not weaken legal, tax, payment, or accounting meaning. Keep the exact term and explain it in plain language the first time an owner needs to act on it.

| Precise term | Owner-facing treatment |
|---|---|
| `FIFO` | Keep `FIFO` and add `الأقدم يتباع الأول` or `الأقدم أولًا`. |
| `فترة محاسبية مغلقة` | Keep the term and explain that no transaction can be recorded for that date. |
| `عكس` / reversal | In actions, say `إلغاء التسجيل`; explain that it corrects the record and does not send money. |
| `مستحقات العملاء` / receivables | Prefer the plain label `مبالغ مستحقة من العملاء`. |
| Tax receipt disclaimer | Preserve `ليس فاتورة ضريبية مصرية أو إيصالًا إلكترونيًا معتمدًا من مصلحة الضرائب` exactly. |
| Manual payment review | State that sending a notice does not activate or change the plan until an operator approves it. |

## Review checklist

For every new or changed owner journey, review Arabic at phone, tablet, and desktop widths; check RTL order, wrapping, focus, and labels; compare the Arabic and English consequences; and run `node --test apps/shop-suit/tests/unit/arabic-copy.test.mjs`.
