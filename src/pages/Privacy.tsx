import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";

const updatedAt = "4 مايو 2026";

// Internal launch note: this page is not a substitute for legal review.
// TODO: Confirm official company legal name, support email, payment handling, retention policy, and data deletion workflow before launch.
const sections = [
  {
    title: "مقدمة",
    body: [
      "نحترم في edio خصوصية زبائننا. توضّح هذه السياسة كيف نتعامل مع البيانات التي نحتاجها لتشغيل المتجر، معالجة الطلبات، وتقديم الدعم.",
    ],
  },
  {
    title: "البيانات التي قد نجمعها",
    body: [
      "قد نجمع الاسم، رقم الهاتف، البريد الإلكتروني، عنوان التوصيل، بيانات الطلبات، وبيانات الحساب عند التسجيل.",
      "قد نجمع أيضاً بيانات تقنية محدودة مثل عنوان IP، نوع الجهاز، المتصفح، وملفات cookies اللازمة للجلسة والسلة وتحسين تجربة الموقع.",
    ],
  },
  {
    title: "كيف نستخدم البيانات",
    body: [
      "نستخدم البيانات لمعالجة الطلبات، التواصل مع الزبون، ترتيب التوصيل، تقديم الدعم، تحسين تجربة الموقع، وحماية الحسابات من إساءة الاستخدام.",
    ],
  },
  {
    title: "الدفع",
    body: [
      "لا نخزن بيانات البطاقات البنكية على خوادمنا إلا إذا كان ذلك موضحاً صراحة من مزود الدفع. عند استخدام مزود دفع خارجي، تتم معالجة بيانات الدفع وفق نظام ذلك المزود.",
    ],
  },
  {
    title: "مشاركة البيانات",
    body: [
      "قد نشارك البيانات الضرورية فقط مع شركات التوصيل، مزودي الدفع، أو مزودي الخدمات التقنية اللازمة لتشغيل المتجر.",
      "لا نبيع بيانات الزبائن.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "نستخدم cookies للحفاظ على الجلسة، السلة، تفضيلات الاستخدام، وتحسين أداء الموقع. يمكن للمتصفح التحكم في cookies، لكن تعطيلها قد يؤثر على بعض وظائف المتجر.",
    ],
  },
  {
    title: "حماية البيانات والاحتفاظ بها",
    body: [
      "نستخدم إجراءات معقولة لحماية البيانات، لكن لا توجد طريقة حماية رقمية مضمونة بالكامل.",
      "نحتفظ بالبيانات بقدر الحاجة لتشغيل الطلبات، الدعم، الحسابات، والالتزامات الإدارية.",
    ],
  },
  {
    title: "حقوق المستخدم والتواصل",
    body: [
      "يمكنك طلب تعديل أو حذف بياناتك حيثما كان ذلك ممكناً ومناسباً لطبيعة الطلبات والالتزامات الإدارية.",
      "للتواصل مع edio، استخدم واتساب أو الهاتف: +964 770 204 6674، أو حساب Instagram الرسمي @edio.iq.",
    ],
  },
];

export default function Privacy() {
  return (
    <Layout>
      <Seo
        title="سياسة الخصوصية"
        description="سياسة خصوصية edio: كيف نجمع ونستخدم بيانات الزبائن لمعالجة الطلبات، الدعم، التوصيل، وحماية الحسابات."
        canonicalPath="/privacy"
        type="website"
      />
      <LegalPage
        eyebrow="Privacy Policy"
        title="سياسة الخصوصية"
        intro="صفحة مختصرة وواضحة لما نحتاجه من بيانات، ولماذا نستخدمها، وكيف يمكن التواصل معنا."
        sections={sections}
      />
    </Layout>
  );
}

function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string[] }>;
}) {
  return (
    <main data-header-surface="dark" className="section-luxury bg-background pt-32 md:pt-40">
      <section className="container-edio pb-16 md:pb-20">
        <div className="max-w-3xl text-start">
          <p className="label-tech text-primary">{eyebrow}</p>
          <h1 className="mt-5 font-display arabic-display-safe text-4xl font-extrabold leading-tight tracking-normal md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">{intro}</p>
          <p className="mt-6 text-sm text-muted-foreground">آخر تحديث: {updatedAt}</p>
        </div>
      </section>

      <section className="border-t border-border/40 bg-surface-lowest py-12 md:py-16">
        <div className="container-edio grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-28 space-y-3" aria-label="فهرس سياسة الخصوصية">
              {sections.map((section) => (
                <a
                  key={section.title}
                  href={`#${slugify(section.title)}`}
                  className="block border-s border-border/70 ps-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-4">
            {sections.map((section, index) => (
              <article
                key={section.title}
                id={slugify(section.title)}
                className="scroll-mt-28 border border-border/50 bg-background p-6 md:p-8"
              >
                <p className="font-mono text-xs text-primary">0{index + 1}</p>
                <h2 className="mt-3 font-display arabic-display-safe text-2xl font-semibold tracking-normal">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-3 text-sm leading-8 text-muted-foreground md:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function slugify(value: string) {
  return value.replace(/\s+/g, "-");
}
