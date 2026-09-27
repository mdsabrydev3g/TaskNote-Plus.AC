# TaskNote Plus — تطبيق الموبايل (Expo / React Native)

تطبيق أصلي يستهلك **Mobile API v1** الموجود في نفس المستودع.
الواجهة عربية RTL افتراضيًا مع تبديل للإنجليزية.

> مقابل الويب في الجذر (`app/`). هذا المجلد مستقل تمامًا: `package.json` و`node_modules`
> وبناء خاص به، ولا يؤثر على نشر Vercel للويب.

## المتطلبات

- Node 22+
- تطبيق **Expo Go** على الهاتف، أو محاكي Android/iOS

## التشغيل

```bash
cd mobile
npm install
npm start          # ثم امسح رمز QR بتطبيق Expo Go
# أو
npm run android
npm run ios
```

## عنوان الـ API

مضبوط في `app.json` تحت `expo.extra.apiBaseUrl` (افتراضيًا النشر الحيّ).
لتجربة خادم محلي، غيّره إلى عنوان جهازك ثم أعد التشغيل:

```json
"extra": { "apiBaseUrl": "http://192.168.1.20:3000" }
```

> لا تستخدم `localhost` من داخل الهاتف — استخدم عنوان الجهاز على الشبكة.

## التحقق

```bash
npm run typecheck       # tsc --noEmit
npm run bundle:android  # حزمة Metro حقيقية — تكشف أي استيراد ناقص أو خطأ بناء
```

`bundle:android` لا يحتاج Android SDK؛ فهو يُنتج حزمة JS فقط، وهذا أقوى دليل متاح
دون جهاز فعلي.

## البنية

```
App.tsx                     # الجذر: تهيئة الجلسة + شريط التبويبات
index.ts                    # registerRootComponent
src/
  api.ts                    # عميل مكتوب الأنواع لواجهة v1
  session.ts                # تخزين الرمز في SecureStore (مع احتياطي في الذاكرة)
  config.ts                 # عنوان الـ API
  i18n.ts                   # عربي/إنجليزي
  theme.ts                  # ألوان + أدوات RTL صريحة
  errors.ts                 # تحويل أخطاء العميل إلى رسائل مترجمة
  screens/
    LoginScreen.tsx         # تسجيل الدخول
    TodayScreen.tsx         # اليوم + المؤشرات
    CaptureScreen.tsx       # التقاط سريع + معالجة الوارد
    TasksScreen.tsx         # مهام + إضافة بلغة طبيعية
    NotesScreen.tsx         # ملاحظات
```

## قرارات مقصودة

- **لا مكتبة تنقّل**: التنقّل بين أربع شاشات بحالة محلية — أقل اعتماديات ممكنة.
- **الأمان**: الرمز في `expo-secure-store` (سلسلة مفاتيح النظام) لا في تخزين عادي.
- **RTL صريح**: `flexDirection: row-reverse` و`textAlign` بدل `I18nManager.forceRTL`
  التي لا تسري إلا بعد إعادة تشغيل التطبيق.
- **التحليل اللغوي على الخادم**: «اتصل بأحمد بكرة الساعة 10 !! #عمل» يُحلَّل في الـ API
  بنفس المحلّل المستخدم في الويب، فلا تتباعد النسختان.

## غير منفَّذ بعد

- العمل دون اتصال (تخزين محلي + مزامنة).
- الإشعارات، بصمة الإصبع، والودجات.
- شاشات المشاريع والأهداف والتقويم (الـ API جاهز لها).
- النشر على App Store / Google Play (يحتاج حسابَي المطوّرين وتوقيعًا).
