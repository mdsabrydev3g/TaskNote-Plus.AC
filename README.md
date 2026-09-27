# TaskNote Plus

> منصة إنتاجية شخصية تجمع الملاحظات والمهام والمشاريع والأهداف والتقويم في مساحة عمل واحدة،
> مع التقاط سريع، بحث موحّد، دعم كامل للعربية (RTL)، وذكاء اصطناعي اختياري لا يعمل إلا بإذنك.
>
> One workspace for notes, tasks, projects, goals and calendar — mobile-first, offline-capable,
> Arabic-first (RTL + Hijri), with an AI layer that is fully optional and permission-gated.

---

## 1. نظرة سريعة / At a glance

| العنصر | التفاصيل |
| --- | --- |
| الاسم الرسمي | **TaskNote Plus** |
| الواجهة | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS |
| قاعدة البيانات | PostgreSQL (Neon) عبر Drizzle ORM |
| الاستضافة | Vercel (Web / PWA) |
| الموبايل | PWA قابل للتثبيت + تصميم mobile-first (خطة React Native لاحقًا) |
| اللغات | العربية (افتراضي، RTL) + الإنجليزية |
| الذكاء الاصطناعي | اختياري تمامًا — وضع محلي افتراضي، لا يوجد أي تدفق أساسي يعتمد عليه |

## 2. ما الموجود في هذه النسخة (MVP)

- **مصادقة**: تسجيل حساب/دخول بالبريد وكلمة المرور (scrypt)، جلسة في كوكي `HttpOnly`،
  جدار حماية بسيط ضد CSRF (فحص الأصل + `SameSite=Lax`)، وتحديد معدل محاولات الدخول.
- **التقاط موحّد (Inbox)**: التقاط نصي فوري، مع **idempotency** عبر بصمة المحتوى
  (إعادة إرسال نفس النص لا تنشئ صفًا مكررًا).
- **ملاحظات**: إنشاء/تحرير/حذف + تثبيت + ربط بمشروع + خيار «متاح للذكاء الاصطناعي».
- **مهام**: حالات (todo/doing/done)، أولوية، وسم طاقة (عميق/خفيف/إداري)، استحقاق،
  تأجيل، مشروع، هدف. عرضان: قائمة ولوحة (Kanban).
- **مشاريع**: معالم + **تقدّم محسوب من المهام** (bottom-up) وليس رقمًا يدويًا.
- **أهداف**: تقدّم محسوب من المهام المرتبطة بالهدف.
- **تقويم**: عرض شهري لليوميات والأحداث + تبديل عرض هجري/ميلادي (بدون مكتبات خارجية).
- **بحث موحّد**: `tsvector` full-text مع تراجع تلقائي إلى `ILIKE` + لوحة أوامر (⌘K / Ctrl+K).
- **الأمان والشفافية**: سجل تدقيق (Audit) حقيقي لكل عملية، وصفحة أذونات قابلة للسحب،
  وسجل لكل نداء ذكاء اصطناعي (`ai_action_logs`).
- **PWA**: `manifest.webmanifest` + Service Worker بسيطة للهيكل الأساسي دون اتصال.

## 3. الاسم القديم / Rename note

تم تغيير الاسم الرسمي إلى **TaskNote Plus** في كل مكان: الواجهة، `package.json`
(`tasknote-plus`)، وسوم PWA، وثائق التعريف، والاختبارات. لا يوجد أي أثر للاسم القديم
في المعرّفات أو النصوص.

## 4. التشغيل محليًا / Local setup

```bash
npm install
cp .env.example .env.local     # ثم املأ القيم
npm run dev                    # http://localhost:3000
```

### متغيرات البيئة

| المتغير | إلزامي | الوصف |
| --- | --- | --- |
| `DATABASE_URL` | نعم (وقت التشغيل) | رابط Neon المجمّع (`-pooler`) |
| `DATABASE_URL_UNPOOLED` | لا | رابط مباشر للهجرات والبذور |
| `AUTH_SECRET` | نعم في الإنتاج | 32 بايت عشوائية على الأقل |
| `APP_URL` | لا (مُستحسن) | الرابط العام للتحقق من الأصل |
| `AI_API_KEY` | لا | عند غيابه يعمل التطبيق في الوضع المحلي |
| `AI_BASE_URL` / `AI_MODEL` | لا | مزوّد متوافق مع OpenAI |

توليد `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> `npm run build` ينجح **بدون** قاعدة بيانات وبدون ملف `.env`؛ الاتصال يتم عند الطلب فقط.

## 5. قاعدة بيانات Neon / Neon setup

1. أنشئ مشروعًا على [Neon](https://neon.tech) واختر المنطقة الأقرب (مثلًا `eu-central-1`).
2. من **Connection Details** انسخ رابط **Pooled** إلى `DATABASE_URL`، ورابط **Direct** إلى
   `DATABASE_URL_UNPOOLED`.
3. طبّق الهجرات واملأ بيانات تجريبية:

```bash
npm run db:generate   # توليد SQL من db/schema.ts إلى db/migrations
npm run db:migrate    # تطبيق الهجرات
npm run db:seed       # بيانات تجريبية
```

الحساب التجريبي بعد `db:seed`:

```
demo@tasknote.local
TaskNote-Demo-2026
```

## 6. النشر على Vercel / Deploy to Vercel

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add AUTH_SECRET production
vercel env add APP_URL production      # https://<your-domain>
vercel --prod
```

- `vercel.json` يحدد الإطار وأمر البناء ومنطقة `fra1` ورؤوس `sw.js`.
- التطبيق يعمل كـ PWA: افتح الموقع على الموبايل ← «إضافة إلى الشاشة الرئيسية».
- لا تضع أي سر داخل المستودع؛ كل الأسرار عبر متغيرات بيئة Vercel.

## 7. البنية / Project layout

```
app/
  (auth)/login, signup        # شاشات الدخول
  (app)/home|inbox|tasks|projects|goals|notes|calendar|search|settings
  actions/                    # Server Actions: auth, capture, tasks, notes, ...
  layout.tsx, globals.css
components/                   # shell, capture, task item, AI panel, palette
db/  schema.ts, client.ts, migrations/
lib/ auth/ (session, password), db/scope.ts, ai/, i18n/, progress, search, validation
scripts/ migrate.ts, seed.ts
tests/ vitest
public/ manifest.webmanifest, sw.js, icons
middleware.ts                 # حماية /app
```

### نقطة مهمة: عزل المستأجرين

كل استعلام يمر عبر `lib/db/scope.ts`. الدالة `assertWorkspaceId` ترفض أي معرّف ناقص،
والاختبار `tests/workspace-scope.test.ts` يضمن ألا يوجد أي مسار استعلام بدون نطاق مساحة العمل.
`workspace_id` يُقرأ دائمًا من الجلسة على الخادم ولا يُقبل من العميل.

## 8. الذكاء الاصطناعي / AI model

- كل نداء يمر عبر بوابة واحدة: `lib/ai/gateway.ts` ثم `lib/ai/service.ts`.
- لا يحدث أي قراءة قبل وجود منح إذن صريح (`read:notes`) قابل للسحب في أي وقت.
- كل نداء يُسجَّل في `ai_action_logs` (المزوّد، الموديل، بصمة الطلب، حدود الإرجاع).
- **لا كتابة بدون تأكيد**: المسودة تُعرض أولًا، والكتابة تحدث فقط بعد ضغط «تأكيد التطبيق».
- المحتوى المسترجع يُعامل دائمًا كبيانات لا كتعليمات (حد صارم ضد Prompt Injection).

## 9. الاختبارات والتحقق / Verification

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest: كلمات المرور، idempotency، عزل مساحة العمل، التقدّم، NL quick-add
npm run build       # بناء إنتاجي بدون قاعدة بيانات
npm run check:routes # يتحقق أن روابط التنقل والـ PWA والميدلوير كلها مسارات موجودة فعلًا

# كل ما سبق بأمر واحد:
npm run verify
```

> `check:routes` يحمي من خطأ حقيقي وقع أثناء التطوير: مجلد `(app)` هو **route group**
> فلا يضيف `/app` إلى الرابط، وبالتالي كل روابط `/app/...` كانت تعيد 404.
> الحل: تسمية المجلد `app/app` حتى تتطابق المسارات مع الروابط والميدلوير.

## 10. القيود المعروفة (صريحة) / Known limitations

- **تحديد المعدّل داخل الذاكرة**: يعمل على نسخة واحدة فقط ويُصفَّر مع cold start.
  استبدله بـ Redis/Upstash قبل أي توسّع حقيقي.
- **بدون Passkeys/MFA**: مطلوبة في خارطة الطريق، ولم تُنفَّذ في هذه المرحلة.
- **بدون مزامنة لحظية/CRDT بعد**: إضافة/تعديل/حذف تُطبَّق على الخادم مباشرة.
- **بدون RLS على مستوى Postgres بعد**: العزل مطبَّق في طبقة الوصول إلى البيانات.
- **رفع الملفات/OCR/RAG**: خارج نطاق هذه المرحلة.
- **تطبيق React Native أصلي**: لم يُنشأ؛ التسليم الحالي هو PWA. النشر على Vercel يخدم الويب.
- الكلمات «Hijri» تعتمد على `Intl` المدمج وليست تقويمًا فلكيًا معتمدًا للفتاوى.

## 11. الخطوة التالية / Next steps

1. ربط `DATABASE_URL` من Neon وتشغيل `db:migrate` + `db:seed`.
2. النشر على Vercel وإضافة `AUTH_SECRET` و`APP_URL`.
3. توسيع المزامنة اللحظية، RLS، وPasskeys وفق مراحل الخارطة الطريقية.
