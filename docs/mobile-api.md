# TaskNote Plus — Mobile API v1

واجهة JSON مُصدَّرة للأجهزة (تطبيق الموبايل، سكربتات، أي عميل خارجي).
النسخة الحالية: **v1** — كل المسارات تحت `/api/v1`.

> Server Actions الخاصة بالويب **لا تُستهلك** من تطبيق أصلي؛ لذلك هذه الواجهة موجودة.

## المصادقة

كل الطلبات المحمية تحتاج ترويسة:

```
Authorization: Bearer <token>
```

يُستخرج الرمز من `POST /api/v1/auth/login` أو `POST /api/v1/auth/signup`.
الرمز هو JWT موقّع (HS256) يحمل `userId` و`workspaceId` و`deviceId`، وصلاحيته 30 يومًا.

اختياريًا أرسل `X-Device-Id: <معرّف ثابت للجهاز>` لتُسجَّل الجلسة باسم الجهاز.
وإن لم ترسله يُولَّد تلقائيًا.

## صيغة الاستجابة

```jsonc
// نجاح
{ "data": { ... } }

// فشل
{ "error": { "code": "invalid_request", "message": "invalid_fields" } }
```

| الحالة | `code` |
| --- | --- |
| 400 | `invalid_request` |
| 401 | `unauthenticated` |
| 404 | `not_found` |
| 409 | `conflict` |
| 429 | `rate_limited` |
| 500 | `internal_error` |

## المسارات

### المصادقة

| الطريقة | المسار | الوصف |
| --- | --- | --- |
| POST | `/api/v1/auth/signup` | `{ name, email, password, workspaceName?, locale? }` → `201` + رمز |
| POST | `/api/v1/auth/login` | `{ email, password }` → `200` + رمز |
| GET | `/api/v1/me` | المستخدم + مساحة العمل + أذونات الذكاء الاصطناعي |

### الالتقاط (Inbox)

| الطريقة | المسار | الوصف |
| --- | --- | --- |
| GET | `/api/v1/capture?status=new\|processed\|discarded\|all` | قائمة الوارد |
| POST | `/api/v1/capture` | `{ rawText, source? }` → `201 created` أو `200 duplicate` |
| POST | `/api/v1/capture/:id` | `{ action: "convert-to-task" \| "convert-to-note" \| "discard" }` |
| DELETE | `/api/v1/capture/:id` | تجاهل (soft) |

**منع التكرار:** إرسال نفس النص مرتين لا يُنشئ صفًا ثانيًا — الشفرة ترجع
`{"status":"duplicate"}` مع العنصر الموجود.

### المهام

| الطريقة | المسار | الوصف |
| --- | --- | --- |
| GET | `/api/v1/tasks?filter=open\|today\|done\|all&projectId=&goalId=` | قائمة |
| POST | `/api/v1/tasks` | حقول صريحة، **أو** `{ "quick": "اتصل بأحمد بكرة الساعة 10 !! #عمل" }` |
| GET | `/api/v1/tasks/:id` | مهمة واحدة |
| PATCH | `/api/v1/tasks/:id` | الحقول المُرسَلة فقط تتغيّر |
| DELETE | `/api/v1/tasks/:id` | حذف |

`quick` يستخدم نفس المحلّل العربي/الإنجليزي الحتمي في الويب (تاريخ، أولوية، نوع طاقة، وسوم).

### الملاحظات والمشاريع والأهداف والبحث

| الطريقة | المسار | الوصف |
| --- | --- | --- |
| GET / POST | `/api/v1/notes` | قائمة / إنشاء |
| GET / PATCH / DELETE | `/api/v1/notes/:id` | قراءة / تعديل جزئي / حذف |
| GET / POST | `/api/v1/projects` | قائمة مع **تقدّم محسوب من المهام** / إنشاء |
| GET / POST | `/api/v1/goals` | قائمة مع تقدّم محسوب / إنشاء |
| GET | `/api/v1/search?q=&types=note,task,project,goal` | بحث موحّد |

## مثال كامل

```bash
BASE=https://task-note-plus-ac.vercel.app

TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"demo@tasknote-plus.app","password":"<password>"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.token')

curl -s "$BASE/api/v1/tasks?filter=open" -H "authorization: Bearer $TOKEN"

curl -s -X POST "$BASE/api/v1/tasks" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"quick":"راجع التقرير بكرة الساعة 9 !!"}'

curl -s -X POST "$BASE/api/v1/capture" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"rawText":"فكرة: قالب مراجعة أسبوعية"}'
```

## ملاحظات أمنية

- كل الاستعلامات مقيّدة بـ `workspaceId` المستخرج من الرمز، ولا يُقبل من جسم الطلب أبدًا.
- لا تُضاف ترويسات CORS، فالواجهة مقصودة للمنادين الأصليين (native) لا لمتصفحات أخرى.
- كل عملية كتابة تُسجَّل في `audit_logs`.
- `GET /api/v1/me` يعرض أذونات الذكاء الاصطناعي ليحترمها العميل (لا قراءة بلا إذن مُمنوح).
