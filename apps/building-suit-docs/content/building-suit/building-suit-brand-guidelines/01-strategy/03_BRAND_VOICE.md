# Brand Voice

> **Status:** Complete (initial). How Building Suit sounds in writing across product and marketing, in English and Arabic. Flows from the brand personality in `01_BRAND_FOUNDATION.md`: trustworthy, clear, organised, warm, premium.

---

## Tone of voice
Building Suit sounds like a **calm, competent building manager you trust** — clear, respectful, and reassuring, never bureaucratic or hyped.

Four constant tone qualities:
- **Clear** — plain language; money and rules explained simply.
- **Trustworthy** — accurate, honest, never alarmist or evasive.
- **Calm** — steady and reassuring, especially around money and errors.
- **Warm & respectful** — human and community-minded, polite to every resident.

**Tone flexes by context** (the personality stays the same):

| Context | Dial up | Dial down |
|---|---|---|
| Onboarding / empty states | Warmth, encouragement | Jargon |
| Financial messages (balances, payments) | Clarity, precision | Emotion, exclamation |
| Errors & failures | Calm, helpfulness, ownership | Blame, alarm, technical detail |
| Urgent announcements | Directness, importance | Panic, drama |
| Marketing | Confidence, benefit | Hype, buzzwords |

---

## Writing principles
1. **Clarity over cleverness.** If a sentence can be simpler, simplify it.
2. **Lead with the benefit or the fact.** Say what it is or what it does for the user first.
3. **Be specific with money and dates.** Exact amounts, units, and dates — never vague.
4. **Use plain, human words.** "Payment recorded," not "transaction successfully persisted."
5. **Take responsibility, never blame the user.** "We couldn't save that" over "You entered invalid data."
6. **Stay calm under pressure.** Errors and money problems get a steady, helpful tone.
7. **Be consistent in terminology.** Use the agreed vocabulary every time (see below).
8. **Respect the reader.** Polite, inclusive, never condescending — across all tech-literacy levels.
9. **Active voice, short sentences.** Easier to read on a phone and to translate.
10. **Write bilingually from the start.** Every string should work naturally in both English and Arabic.

### Vocabulary
**Preferred:** unit, building, resident, owner, tenant, charge, payment, expense, balance, ledger, issue, announcement, vote, join request. Use "service provider" only in explicitly marked Future/Post-MVP context.
**Avoid:** "tenant" to mean any resident (be precise: owner vs. tenant), "transaction" in user-facing copy (prefer payment/charge/expense), internal jargon ("entity," "record persisted," "endpoint"), hype words ("revolutionary," "magical," "world-class").

---

## English voice examples
Short, reusable patterns that show the voice in action.

- **Welcome:** "Welcome to Building Suit. Let's get your building set up."
- **Empty state (payments):** "No payments yet. Once you record one, it'll appear here with the unit balance updated."
- **Balance summary:** "Unit 4B has an outstanding balance of EGP 1,200 across 2 charges."
- **Payment confirmation:** "Payment recorded. Unit 4B's balance is now EGP 0."
- **Error (save failed):** "We couldn't save that just now. Please check your connection and try again."
- **Urgent announcement:** "Water will be shut off Saturday, 9 AM–1 PM, for tank maintenance. Please store water in advance."
- **Vote prompt:** "A new vote is open: Replace the lobby lighting. Voting closes Friday."
- **Reassurance (audit):** "Every change is recorded, so the building's history stays accurate."

---

## Arabic voice examples
Arabic copy uses **Modern Standard Arabic (MSA)** for clarity and trust, kept warm and simple (not stiff or overly formal). Right-to-left (RTL) layout is assumed; numbers and currency follow the product's localisation rules. These mirror the English examples in meaning and tone.

- **Welcome / ترحيب:** «أهلًا بك في Building Suit. لنبدأ بإعداد مبناك.»
- **Empty state / حالة فارغة (المدفوعات):** «لا توجد مدفوعات بعد. بمجرد تسجيل أول دفعة ستظهر هنا مع تحديث رصيد الوحدة.»
- **Balance summary / ملخّص الرصيد:** «الوحدة 4B عليها رصيد مستحق قدره ١٬٢٠٠ ج.م على دفعتين.»
- **Payment confirmation / تأكيد الدفع:** «تم تسجيل الدفعة. أصبح رصيد الوحدة 4B الآن ٠ ج.م.»
- **Error / رسالة خطأ (فشل الحفظ):** «تعذّر علينا الحفظ الآن. يُرجى التحقق من الاتصال والمحاولة مرة أخرى.»
- **Urgent announcement / إعلان عاجل:** «سيتم قطع المياه يوم السبت من ٩ صباحًا حتى ١ ظهرًا لصيانة الخزان. يُرجى تخزين المياه مسبقًا.»
- **Vote prompt / تصويت جديد:** «بدأ تصويت جديد: استبدال إنارة المدخل. ينتهي التصويت يوم الجمعة.»
- **Reassurance / طمأنة (السجل):** «يتم تسجيل كل تغيير، حتى يبقى سجل المبنى دقيقًا.»

> **Bilingual notes:** keep both languages equal in quality (Arabic is not an afterthought); avoid literal word-for-word translation — translate the *meaning and tone*; keep the product name "Building Suit" in Latin script; ensure UI copy fits RTL layouts and that mixed Arabic + Latin/number strings render cleanly.

---

## Do / Don't writing examples

| Scenario | ✅ Do | ❌ Don't |
|---|---|---|
| Payment success | "Payment recorded. Balance updated." | "Transaction successfully persisted to the ledger." |
| Error | "We couldn't save that. Please try again." | "Error 500: invalid input." |
| Overdue balance | "Unit 4B has EGP 1,200 outstanding." | "Unit 4B is a bad payer." |
| Onboarding | "Let's set up your building — it takes a few minutes." | "Complete the mandatory onboarding workflow." |
| Marketing headline | "See exactly where your building's money goes." | "The world's most revolutionary building app!" |
| Urgent notice | "Water off Saturday 9 AM–1 PM." | "EMERGENCY!! READ NOW!!!" |
| Feature name | "Votes" | "Democratic decision-making engine" |

**General don'ts:** no hype or superlatives, no blame, no exclamation pile-ups, no jargon, no vague money/time references, no fear-based urgency.

---

## App UI copy guidance
- **Be brief.** Buttons are verbs ("Record payment," "Post announcement," "Open vote"); labels are nouns ("Balance," "Units," "Expenses").
- **Empty states teach.** Say what will appear and the one action to take.
- **Confirmations state the result + the new state.** "Payment recorded. Balance now EGP 0."
- **Errors are calm and actionable.** Name what happened in plain words and the next step; never show raw codes to users.
- **Money is always precise.** Show currency, amount, unit, and date consistently.
- **Destructive / financial actions get clear confirmation.** Explain the effect before the user commits (and reflect that corrections are tracked, not hidden).
- **Status language is consistent.** Reuse the same status words across issues, votes, and approvals (e.g. Open, In progress, Closed).
- **Respect both languages.** Keep strings translation-friendly: avoid concatenation that breaks in RTL, leave room for longer Arabic/English text.

---

## Marketing copy guidance
- **Lead with the outcome, not the feature.** "Finally see where your building's money goes" before "ledger module."
- **Sell trust and clarity.** The core promise — *clarity you can trust* — should be felt in every headline.
- **Confident, not hyped.** State strong benefits plainly; let the premium look carry the polish. Avoid superlatives and buzzwords.
- **Use real scenarios.** Group-chat chaos, disputed dues, lost receipts → the calm, transparent alternative.
- **Keep it warm and human.** It's about communities and homes, not just software.
- **Bilingual parity.** Headlines and value props must work natively in both Arabic and English; design for RTL.
- **Consistent vocabulary and tagline.** Use the agreed terms and reinforce **"Building Suit — clarity you can trust."**
- **Let the brand assets do the premium lifting.** Pair restrained copy with the navy/gold/silver system and the building-B mark.
