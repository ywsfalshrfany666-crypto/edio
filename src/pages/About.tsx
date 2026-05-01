import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout/Layout";

const About = () => {
  const { t } = useTranslation();
  const titleLines = t("about.title").split("\n");
  const values = t("about.values", { returnObjects: true }) as { title: string; body: string }[];

  return (
    <Layout>
      <section data-header-surface="dark" className="pt-32 md:pt-44 pb-24 bg-background">
        <div className="container-edio max-w-5xl">
          <p className="label-tech text-primary mb-6">{t("about.eyebrow")}</p>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-normal leading-[0.95]">
            {titleLines.map((l, i) => (
              <span key={i} className="block">{l}</span>
            ))}
          </h1>
          <p className="mt-12 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">{t("about.body")}</p>
        </div>
      </section>

      <section data-header-surface="dark" className="py-24 bg-surface-lowest">
        <div className="container-edio">
          <div className="grid gap-px sm:grid-cols-3 bg-border/30">
            {values.map((v, i) => (
              <div key={i} className="bg-surface-lowest p-10">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight">{v.title}</h3>
                <p className="mt-4 text-muted-foreground leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-header-surface="dark" className="bg-background py-20">
        <div className="container-edio grid gap-px bg-border/25 md:grid-cols-3">
          <article id="faq" className="scroll-mt-28 bg-background p-8 md:p-10">
            <p className="label-tech text-primary">FAQ</p>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-normal">Need a quick answer?</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Message Edio with the product you are considering. We can help with fit, pairing, availability, and order status.
            </p>
          </article>
          <article id="privacy" className="scroll-mt-28 bg-background p-8 md:p-10">
            <p className="label-tech text-primary">Privacy</p>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-normal">Customer details stay private.</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              We use order and contact information only to process purchases, support requests, and store communication.
            </p>
          </article>
          <article id="terms" className="scroll-mt-28 bg-background p-8 md:p-10">
            <p className="label-tech text-primary">Terms</p>
            <h2 className="mt-5 font-display text-2xl font-semibold tracking-normal">Clear purchase support.</h2>
            <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
              Product condition, availability, payment, and delivery details are confirmed before each order is completed.
            </p>
          </article>
        </div>
      </section>
    </Layout>
  );
};

export default About;
