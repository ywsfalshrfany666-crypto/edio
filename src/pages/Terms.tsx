import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";

const updatedAt = "4 مايو 2026";

// Internal launch note: these customer-facing terms are intentionally simple.
// TODO: Confirm official return, exchange, warranty, legal company name, and payment policies before launch.
const sections = [
  {
    title: "مقدمة",
    body: [
      "باستخدام موقع edio أو إرسال طلب عبره، يوافق المستخدم على هذه الشروط. هدفها توضيح طريقة استخدام المتجر والشراء منه بشكل بسيط ومباشر.",
    ],
  },
  {
    title: "المنتجات والمعلومات",
    body: [
      "نحاول عرض معلومات دقيقة عن المنتجات، الصور، المواصفات، والأسعار. قد تختلف تجربة المنتج الصوتي حسب الجهاز، المصدر، الإعدادات، وطريقة الاستخدام.",
      "قد تظهر اختلافات بسيطة بين الصور والمنتج الفعلي بسبب الإضاءة، النسخة، اللون، أو تحديثات البراند.",
    ],
  },
  {
    title: "الأسعار والتوفر",
    body: [
      "تظهر الأسعار بالعملة المعروضة في الموقع، وقد تتغير دون إشعار مسبق.",
      "توفر المنتجات قد يتغير. إذا ظهر خطأ واضح في السعر أو التوفر، يمكن لـ edio مراجعة الطلب والتواصل مع الزبون قبل تأكيده.",
    ],
  },
  {
    title: "الطلبات",
    body: [
      "لا يعتبر الطلب مؤكداً نهائياً إلا بعد مراجعة edio وتأكيد تفاصيله عند الحاجة.",
      "قد نتواصل مع الزبون لتأكيد المنتج، العنوان، طريقة الدفع، أو أي تفاصيل ضرورية قبل تجهيز الطلب.",
    ],
  },
  {
    title: "الدفع",
    body: [
      "طرق الدفع المتاحة تظهر أثناء إتمام الطلب. إذا كان الدفع عند الاستلام متاحاً، يتم تأكيده حسب المدينة وحالة الطلب.",
      "إذا تم استخدام دفع إلكتروني، تتم معالجة العملية عبر مزود الدفع المعتمد دون حفظ بيانات البطاقة في واجهة المتجر.",
    ],
  },
  {
    title: "التوصيل",
    body: [
      "يتم ترتيب التوصيل داخل العراق حسب توفر المنتج والمدينة ومزود التوصيل.",
      "تختلف مدة التوصيل حسب المدينة وتوفر المنتج، وقد يتم التواصل مع الزبون لتأكيد التفاصيل قبل الإرسال.",
    ],
  },
  {
    title: "الإرجاع والاستبدال",
    body: [
      "تتم مراجعة طلبات الإرجاع أو الاستبدال حسب حالة المنتج، طبيعة الاستخدام، وسبب الطلب. يرجى التواصل مع edio قبل إعادة أي منتج لتوضيح الخطوات المتاحة.",
      "قد تختلف شروط المنتجات المفتوحة أو المستخدمة أو ذات الطبيعة الصحية مثل بعض ملحقات الأذن حسب الحالة.",
    ],
  },
  {
    title: "المستعمل المعتمد",
    body: [
      "المنتجات المستعملة أو المستعمل المعتمد قد تحتوي آثار استخدام طبيعية. يتم توضيح حالة المنتج قدر الإمكان قبل البيع.",
      "الضمان أو الإرجاع للمنتجات المستعملة يعتمد على حالة المنتج وسياسة edio المعتمدة لكل حالة.",
    ],
  },
  {
    title: "الضمان",
    body: [
      "تختلف شروط الضمان حسب المنتج، البراند، حالة المنتج، وطريقة الشراء. لا يوجد ضمان موحد لكل المنتجات ما لم يتم توضيحه مع المنتج أو عند تأكيد الطلب.",
    ],
  },
  {
    title: "حساب المستخدم والاستخدام الممنوع",
    body: [
      "المستخدم مسؤول عن صحة بيانات الحساب والطلب. يمنع استخدام الموقع للاحتيال، إساءة الاستخدام، محاولة اختراق الخدمات، أو تعطيل عمل المتجر.",
    ],
  },
  {
    title: "حدود المسؤولية وتحديث الشروط",
    body: [
      "لا تتحمل edio مسؤولية الأضرار غير المباشرة أو سوء استخدام المنتج أو استخدامه خارج الغرض المعتاد.",
      "يمكن تحديث هذه الشروط عند الحاجة، وتكون النسخة المنشورة في الموقع هي النسخة المعتمدة.",
    ],
  },
  {
    title: "التواصل",
    body: ["لأي سؤال حول الطلبات أو الشروط، تواصل مع edio عبر واتساب أو الهاتف: +964 770 204 6674، أو Instagram @edio.iq."],
  },
];

export default function Terms() {
  return (
    <Layout>
      <Seo
        title="الشروط والأحكام"
        description="شروط وأحكام edio: معلومات الطلبات، الأسعار، التوفر، الدفع، التوصيل، الإرجاع، الضمان، واستخدام الموقع."
        canonicalPath="/terms"
        type="website"
      />
      <main data-header-surface="dark" className="section-luxury bg-background pt-32 md:pt-40">
        <section className="container-edio pb-16 md:pb-20">
          <div className="max-w-3xl text-start">
            <p className="label-tech text-primary">Terms & Conditions</p>
            <h1 className="mt-5 font-display arabic-display-safe text-4xl font-extrabold leading-tight tracking-normal md:text-6xl">
              الشروط والأحكام
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              شروط مختصرة توضّح طريقة الشراء من edio، وما يجب معرفته حول المنتجات، الطلبات، الدفع، والتوصيل.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">آخر تحديث: {updatedAt}</p>
          </div>
        </section>

        <section className="border-t border-border/40 bg-surface-lowest py-12 md:py-16">
          <div className="container-edio grid gap-8 lg:grid-cols-[240px_1fr]">
            <aside className="hidden lg:block">
              <nav className="sticky top-28 space-y-3" aria-label="فهرس الشروط والأحكام">
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
                  <p className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</p>
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
    </Layout>
  );
}

function slugify(value: string) {
  return value.replace(/\s+/g, "-");
}
