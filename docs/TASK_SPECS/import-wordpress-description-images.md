# Task Spec: Import WordPress Description Images

## Task ID
import-wordpress-description-images

## Date
2026-05-04

## Execution Brief
Import WordPress/WooCommerce product descriptions and description/spec images into Edio only for safe exact product matches with confidence `>= 0.90`. Scope is limited to WordPress import logic, product descriptions, description blocks, product media, product detail rendering, admin preview/dry-run/apply behavior, image safety, audit logging, rollback, and related tests. Do not inspect unrelated project areas. Do not create products, update price, stock, categories, main images, or galleries. Do not import fuzzy matches or ambiguous/duplicate/conflict rows. Use existing description block/media systems when available; otherwise add an additive safe path. Convert old HTML into sanitized blocks, preserve order, keep description images out of galleries, validate image URLs, dedupe by source URL/filename/hash where available, and render public-safe blocks lower on the product detail page. Admin/debug metadata may remain admin-only. Acceptance requires safe dry-run/apply, no mixed product images, no unsafe HTML, audit logs, rollback by import job, tests, and build/lint/test when practical.

## Goal
استيراد وصف المنتجات القديم وصور الوصف/المواصفات من ملف WordPress/WooCommerce وربطها بالمنتجات المطابقة في Edio بدقة عالية فقط، ثم عرض صور الوصف أسفل صفحة المنتج العامة ضمن قسم الوصف.

## Scope
- WordPress/WooCommerce import parsing and matching.
- Product description and description blocks.
- Product media linked to description blocks.
- Product detail page rendering for description blocks.
- Admin import preview or dry-run/apply safe mode.
- Image URL safety/normalization/deduplication.
- Audit logs and rollback for this import.
- Tests for parsing, matching, import, rendering, security, and rollback where practical.

## Out of Scope
- لا إنشاء منتجات جديدة.
- لا تحديث الأسعار أو المخزون أو التصنيفات.
- لا تعديل main image أو gallery.
- لا تغيير صفحة المتجر خارج عرض description blocks.
- لا fuzzy imports أو تخمين صور.
- لا تغيير AI import أو WordPress import الحالي خارج المسار المطلوب.
- لا تعديل recommendations أو quality score إلا إذا كان عرض الوصف يتطلب قراءة بيانات موجودة.

## Current Problem
ملف WordPress القديم يحتوي أوصافاً وصوراً داخل HTML description لم تظهر بعد في Edio بشكل منظم. المطلوب استيراد هذه الصور والوصف لكل منتج صحيح فقط، دون خلط صور بين المنتجات أو استخدام matches غير مؤكدة.

## Required Changes
- استخراج `long description`, `short description`, HTML content, images inside descriptions, captions, alt text, source URLs, order, and old product identifiers from the WooCommerce export.
- مطابقة المنتجات فقط عبر:
  - SKU exact match.
  - legacy_id exact match.
  - slug exact match.
  - exact normalized title + brand/model.
- تطبيق threshold `confidence >= 0.90`.
- تخطي duplicates, conflicts, ambiguous rows, fuzzy matches, low confidence, invalid/broken/unsafe images.
- تحويل HTML إلى safe description blocks مرتبة.
- تصنيف images إلى `image` أو `spec_image` عند وجود دلائل واضحة.
- عدم وضع description images داخل gallery.
- Deduplicate imported blocks/media by normalized URL, filename, checksum/hash when available, and existing source URL.
- دعم dry-run summary + safe apply mode إن لم توجد واجهة preview جاهزة.
- تسجيل audit logs للأحداث المهمة.
- إضافة rollback قدر الإمكان عبر `import_job_id`, `source=wordpress`, و`source_url`.
- عرض description blocks أسفل صفحة المنتج العامة ضمن قسم الوصف، مع lazy loading وصور نظيفة responsive.

## Existing Features To Preserve
- AI import.
- WordPress import الحالي.
- Product quality score.
- Product recommendations.
- Product images and gallery.
- Spec images.
- Audit logs.
- Bulk edit/admin flows.
- Public stock hiding rule.
- SEO/OG.
- Products without description blocks must continue to render normally.

## Acceptance Criteria
- كل وصف وصورة وصف مستوردة مرتبطة بالمنتج الصحيح فقط.
- لا يتم استيراد أي match أقل من `0.90`.
- لا يتم استيراد fuzzy matches.
- لا توجد صور مختلطة بين المنتجات.
- الوصف القديم يتحول إلى blocks آمنة عند الإمكان.
- صور الوصف/spec تظهر أسفل صفحة المنتج، لا في gallery.
- لا يتم تعديل price/stock/category/main image/gallery.
- لا raw unsafe HTML في الواجهة العامة.
- لا localhost/private/file/ftp/unsafe image URLs.
- لا صور مكررة بلا داع.
- audit logs موجودة.
- rollback ممكن للبيانات المضافة من import job.
- tests/build/lint تعمل عند الإمكان.

## Safety Rules
- الدقة أهم من عدد المنتجات المستوردة.
- أي شك أو تعارض يعني skip + needs_review.
- لا تستخدم AI لتخمين الصور أو المواصفات.
- لا تضف specs مستخرجة من spec image إلا إذا كان الاستخراج واضحاً وبثقة عالية؛ إذا OCR غير متاح، احتفظ بالصورة فقط.
- SVG يتم تخطيه إلا إذا كان sanitization قوياً.
- allowed image types: jpg, jpeg, png, webp, avif إن كان مدعوماً.
- image fetch/check must use timeout, max size, content-type/MIME validation, and private-network blocking.

## Test Plan
- Parsing: extract `img` tags, preserve order, alt/caption, and detect spec images.
- Matching: exact SKU/slug imports; fuzzy/low-confidence/duplicate conflicts skip.
- Import: correct product blocks, no gallery changes, no price/stock/category changes, deduplication.
- Rendering: product page renders blocks below main area; old products without blocks still render.
- Security: unsafe HTML sanitized; localhost/private/invalid/broken image URLs skipped.
- Rollback: removes only blocks/media from the import job.

## Final Report Format
- WordPress file used.
- Count matched with confidence `>= 0.90`.
- Count skipped and reasons.
- Text/image/spec blocks added.
- Duplicate and broken images skipped.
- Confirmation that price/stock/category were not modified.
- Where description images render.
- Files changed.
- Tests added/run and build/lint/test status.
- Products needing review.
