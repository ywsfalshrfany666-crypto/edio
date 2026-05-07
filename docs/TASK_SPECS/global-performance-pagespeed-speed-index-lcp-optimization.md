# Task Spec: Global Performance PageSpeed Speed Index LCP Optimization

## Task ID
global-performance-pagespeed-speed-index-lcp-optimization

## Date
2026-05-04

## Execution Brief
إجراء Performance Audit عالمي لموقع Edio باستخدام مصادر موثوقة وأدوات قياس متاحة داخل بيئة Codex فقط، ثم إصلاح أسباب بطء Speed Index/LCP/TBT/CLS بأقل تغييرات آمنة. النطاق يقتصر على ملفات الأداء والصفحات المتأثرة: App/routes، homepage/shop/category/product/login، Header/nav، runtime catalog/API، SEO helpers، Vite/build، public/.htaccess، ومكوّنات above-the-fold التي تثبت القياسات أنها سبب المشكلة. يمنع استخدام متصفح المستخدم الشخصي أو الاعتماد على جلساته، ويمنع الرفع إلى GitHub أو deploy. يجب الحفاظ على Google Login و/auth/callback وSEO/sitemap/robots/schema وبيانات المنتجات. القبول يتطلب قياس baseline، تحديد الأسباب، تنفيذ تحسينات آمنة، إعادة lint/typecheck/test/build، اختبار preview/routes، تجهيز deploy folder نظيف، وتقرير before/after واضح مع أي أدوات خارجية تعذر استخدامها.

## Goal
خفض مؤشرات الأداء قدر الإمكان، خصوصاً Speed Index وLCP وTBT وCLS، ومعالجة تحذيرات PageSpeed الحالية: render-blocking، forced reflow، LCP request discovery، network dependency tree، image optimization، DOM size، unused JavaScript/CSS، وlong tasks.

## Scope
- `src/App.tsx`
- `src/pages/Index.tsx`
- `src/pages/Shop.tsx`
- `src/pages/Category.tsx`
- `src/pages/ProductDetail.tsx`
- `src/pages/Login.tsx` أو صفحة login الحالية
- `src/components/layout/Header.tsx`
- `src/components/layout/navData.ts` أو `navData.tsx`
- `src/lib/runtimeCatalog.ts`
- `src/lib/api.ts`
- `src/data/catalog.ts`
- `src/lib/seo.ts`
- `src/components/Seo.tsx`
- `vite.config.ts`
- `package.json`
- `public/.htaccess`
- `scripts/generate_static_seo.mjs` إن وجد
- مكونات above-the-fold فقط إذا أثبتت القياسات أنها سبب أداء مباشر

## Out of Scope
- GitHub push أو Hostinger deploy.
- تغييرات UI جذرية.
- تغيير بيانات المنتجات أو حذف منتجات/صفحات.
- تعديل Supabase أو Google Cloud.
- استخدام `server/index.js` في production.
- إضافة SaaS أو Marketplace أو multi-vendor.
- أي مكتبات ثقيلة أو features جديدة.

## Current Problem
PageSpeed أشار إلى Speed Index يقارب 2.3s مع render-blocking requests، forced reflow، مشاكل LCP discovery/network chain، image savings تقارب 548 KiB، unused JS/CSS، DOM size، و4 long tasks.

## Required Changes
1. بحث حديث من مصادر موثوقة حول أفضل ممارسات الأداء.
2. قياس baseline على production/local preview قدر الإمكان.
3. تحديد root causes قبل التعديل.
4. إصلاح render-blocking/LCP/images/forced reflow/unused JS/CSS/long tasks/DOM/network بما يلزم فقط.
5. الحفاظ على SEO/Auth/security.
6. إعادة build وتجهيز deploy folder دون push.

## Existing Features To Preserve
- Google Login و`/auth/callback`.
- تسجيل الدخول العادي إن وجد.
- Cart/shop/product/category routing.
- SEO/sitemap/robots/schema.
- صور المنتجات والوصف والمواصفات.
- Header/Footer/current UI.
- Stock privacy والبيانات العامة.

## Acceptance Criteria
- Baseline موثق قبل التعديل.
- أرقام أو ملاحظات after موثقة حسب الأدوات المتاحة.
- TBT = 0ms أو أقل من 50ms إن أمكن.
- Speed Index وLCP يتحسنان أو يوضّح سبب عدم قياس after بدون deploy.
- لا regression في SEO/Auth.
- lint/typecheck/test/build تمر أو توثق أسباب الفشل.
- deploy folder نظيف ويحتوي static output فقط.

## Safety Rules
- استخدم Browser داخل Codex فقط، وليس متصفح المستخدم الشخصي.
- لا تطبع secrets أو tokens.
- لا ترفع `.env` أو `src` أو `server` أو `node_modules`.
- لا تستخدم service role key في frontend.
- لا تخترع مواصفات أو reviews/ratings.
- لا تعمل deploy أو GitHub push.

## Test Plan
- PageSpeed/Lighthouse/trace/WebPageTest حيثما توفر.
- Build production ثم static preview.
- اختبار `/`, `/shop`, `/category/iems`, صفحة منتج، `/login`, `/auth/callback`, `/sitemap.xml`, `/robots.txt`.
- فحص bundle/assets/deploy folder/secrets.
- تشغيل `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Final Report Format
اتبع تقرير المستخدم المطلوب: overall result، tools used، before/after metrics لكل route، problems fixed، bundle/assets، SEO/Auth regression، build checks، deploy folder، remaining issues، وFinal Decision.
