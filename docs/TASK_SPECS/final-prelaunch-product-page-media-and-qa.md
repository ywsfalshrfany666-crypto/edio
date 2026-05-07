# Task Spec: Final Prelaunch Product Page Media And QA

## Task ID
final-prelaunch-product-page-media-and-qa

## Date
2026-05-04

## Execution Brief
Fix the Product Detail Page main product media surface so the primary image fills the display frame professionally without large white padding or an inner white box, while preserving thumbnails, gallery navigation, and the portal lightbox behavior. Scope is limited to product detail media/gallery/image helpers/styles, then a quick QA smoke pass on critical launch pages: homepage, product detail, category/listing, search, cart/checkout where available, header, footer, titles/SEO, console/build errors, and basic public data/privacy checks. Do not add new features, inspect the whole project randomly, alter backend/import systems, change product data, prices, stock, categories, description/spec images, recommendations, or rebuild the product page. Run build/lint/typecheck/tests when practical and update task history after execution. Acceptance requires main PDP image to avoid distracting white gaps, thumbnails and lightbox to still work, no effect on description/spec media, mobile-safe layout, no horizontal overflow, successful build, and a short launch-readiness report.

## Goal
إصلاح عرض صورة المنتج الرئيسية في صفحة المنتج قبل الرفع، ثم تنفيذ فحص QA سريع للصفحات الحرجة فقط.

## Scope
- Product detail page.
- Product gallery.
- Product main image component.
- Product thumbnails.
- Product image wrapper/styles.
- Product lightbox/zoom فقط إذا كان يستخدم نفس component.
- Product media helper.
- CSS/Tailwind المرتبط بصورة صفحة المنتج.
- QA سريع للصفحات الحرجة: homepage, product detail, product listing/category, search, cart/checkout, header, footer, SEO/titles, console/build smoke, public data/privacy smoke.

## Out of Scope
- لا redesign.
- لا ميزات جديدة.
- لا فحص كامل عشوائي للمشروع.
- لا backend import / WordPress import / AI import.
- لا تغيير بيانات المنتج أو الأسعار أو المخزون أو التصنيفات.
- لا تغيير description images أو spec images أو description blocks.
- لا حذف gallery أو thumbnails أو lightbox.
- لا إضافة مكتبة ثقيلة.
- لا refactor واسع.

## Current Problem
صورة المنتج الرئيسية داخل Product Detail Page تظهر داخل مساحة بيضاء كبيرة مع padding/contain، مما يجعلها تبدو كصورة صغيرة داخل مربع أبيض داخل layout داكن.

## Required Changes
- إزالة الإحساس بالمربع الأبيض الداخلي في صورة PDP الرئيسية.
- جعل الصور العادية/lifestyle تملأ الإطار بصرياً باستخدام fit مناسب.
- إبقاء PNG الشفاف على خلفية `#FFFFFF` لكن بدون padding كبير.
- فصل سلوك PDP main image عن lightbox: main image يملأ الإطار، lightbox يعرض الصورة كاملة قدر الإمكان.
- الحفاظ على thumbnails والتنقل والـ lightbox المستقل.
- عدم لمس description/spec images.
- تنفيذ QA smoke للصفحات الحرجة فقط.

## Existing Features To Preserve
- Product gallery.
- Product thumbnails.
- Portal lightbox/zoom.
- Product cards.
- Description images and spec images.
- Public stock hiding rule.
- Header navigation.
- Search.
- Cart/checkout.
- SEO/OG/titles.
- Hidden/archived/needs_review storefront filtering.

## Acceptance Criteria
- صورة PDP الرئيسية لا تظهر داخل مساحة بيضاء مزعجة.
- الصورة تملأ إطارها بشكل premium بدون تشويه واضح.
- thumbnails تعمل.
- lightbox يعمل بدون تداخل.
- صور الوصف/spec لم تتأثر.
- product cards لم تتكسر.
- mobile يعمل بدون horizontal overflow.
- header/footer/search/category/product/cart smoke checks لا تكشف كسر واضح.
- build/lint/typecheck/tests تعمل إن أمكن.
- تحديث `docs/TASK_HISTORY.md`.

## Safety Rules
- أصلح media surface فقط.
- لا تغير source data.
- لا تطبق `cover` على description/spec images.
- لا تطبق processing ثقيل أثناء render.
- إذا كانت الحواف داخل الصورة نفسها ولا يوجد حل آمن، استخدم CSS fit مناسب واذكر ذلك.

## Test Plan
- Static: inspect ProductGallery/ProductDetail/product image helper/CSS.
- Automated: targeted lint/typecheck/build/tests.
- Browser/HTTP smoke where possible for critical pages.
- Verify public API/storefront does not expose hidden/internal stock behavior where practical.

## Final Report Format
- سبب الفراغ الأبيض.
- الملفات المعدلة.
- هل المشكلة CSS أو image source أو الاثنين.
- كيف تم إصلاح main product image.
- تأثير Lightbox/thumbnails/description/spec images.
- mobile/QA summary.
- build/lint/test status.
- مشاكل متبقية قبل الرفع.
- هل الموقع جاهز للرفع أم لا.
