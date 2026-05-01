import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ChevronDown, Instagram, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "./Header";
import { cn } from "@/lib/utils";

type FooterLink = {
  label: string;
  to: string;
  external?: boolean;
};

type FooterGroup = {
  title: string;
  links: FooterLink[];
};

const copy = {
  en: {
    navLabel: "Footer navigation",
    locationPrefix: "Showroom",
    instagram: "Instagram",
    needHelp: "Need help choosing gear?",
    adviceTitle: "Talk to Edio",
    adviceBody: "Tell us what you listen to and we’ll recommend the right setup.",
    adviceCta: "Get advice",
    trustLine: "Pre-purchase advice · Order help · After-sales support",
    company: "Company",
    legal: {
      copyright: "© {{year}} Edio",
      privacy: "Privacy",
      terms: "Terms",
    },
  },
  ar: {
    navLabel: "تنقل الفوتر",
    locationPrefix: "المعرض",
    instagram: "إنستغرام",
    needHelp: "تحتاج مساعدة في اختيار جهازك؟",
    adviceTitle: "تحدث مع Edio",
    adviceBody: "أخبرنا بما تستمع إليه وسنقترح لك التجهيز الأنسب.",
    adviceCta: "احصل على نصيحة",
    trustLine: "نصيحة قبل الشراء · مساعدة الطلبات · دعم ما بعد البيع",
    company: "الشركة",
    legal: {
      copyright: "© {{year}} Edio",
      privacy: "الخصوصية",
      terms: "الشروط",
    },
  },
};

export function Footer() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const lang = i18n.language.startsWith("ar") ? "ar" : "en";
  const text = copy[lang];
  const year = new Date().getFullYear();

  const groups: FooterGroup[] = [
    {
      title: t("footer.sections.shop"),
      links: [
        { label: t("footer.links.shopAll"), to: "/shop" },
        { label: t("footer.links.newArrivals"), to: "/shop?sort=newest" },
        { label: t("footer.links.preowned"), to: "/shop?filter=preowned" },
      ],
    },
    {
      title: t("footer.sections.support"),
      links: [
        { label: t("footer.links.contact"), to: "https://t.me/edio_iq", external: true },
        { label: t("footer.links.trackOrder"), to: "/account/orders" },
        { label: t("footer.links.faq"), to: "/about#faq" },
      ],
    },
    {
      title: text.company,
      links: [
        { label: t("footer.links.about"), to: "/about" },
        { label: t("footer.links.journal"), to: "/#journal" },
      ],
    },
  ];

  const legalLinks: FooterLink[] = [
    { label: text.legal.privacy, to: "/about#privacy" },
    { label: text.legal.terms, to: "/about#terms" },
  ];

  const isCurrent = (to: string) => {
    if (/^https?:\/\//i.test(to) || to.startsWith("tel:")) return false;
    const [withoutHash] = to.split("#");
    const [pathname, search = ""] = withoutHash.split("?");
    return location.pathname === pathname && (!search || location.search === `?${search}`);
  };

  return (
    <footer className="edio-footer mt-24" data-header-surface="dark" aria-label={lang === "ar" ? "فوتر الموقع" : "Site footer"}>
      <div className="container-edio">
        <div className="edio-footer__grid">
          <section className="edio-footer__brand" aria-label="Edio">
            <Logo className="text-2xl" />
            <p className="edio-footer__tagline">{t("footer.tagline")}</p>

            <ul className="edio-footer__contact" aria-label={lang === "ar" ? "معلومات التواصل" : "Contact details"}>
              <li>
                <MapPin className="h-4 w-4" aria-hidden="true" />
                <span>
                  <span className="sr-only">{text.locationPrefix}: </span>
                  {t("footer.location")}
                </span>
              </li>
              <li>
                <a href="tel:+9647702046674" dir="ltr">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  <span>+964 770 204 6674</span>
                </a>
              </li>
              <li>
                <a href="https://instagram.com/edio.iq" target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                  <span>{text.instagram}</span>
                </a>
              </li>
            </ul>
          </section>

          <nav className="edio-footer__nav edio-footer__nav--desktop" aria-label={text.navLabel}>
            {groups.map((group) => (
              <FooterGroupLinks key={group.title} group={group} isCurrent={isCurrent} />
            ))}
          </nav>

          <nav className="edio-footer__nav edio-footer__nav--mobile" aria-label={text.navLabel}>
            {groups.map((group) => (
              <details key={group.title} className="edio-footer__accordion">
                <summary>
                  <span>{group.title}</span>
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <FooterLinkList links={group.links} isCurrent={isCurrent} />
              </details>
            ))}
          </nav>

          <section className="edio-footer__cta" aria-labelledby="footer-advice-title">
            <p className="label-tech text-primary">{text.needHelp}</p>
            <h2 id="footer-advice-title" className="font-display arabic-display-safe">
              {text.adviceTitle}
            </h2>
            <p>{text.adviceBody}</p>
            <a
              href="https://t.me/edio_iq"
              target="_blank"
              rel="noopener noreferrer"
              className="edio-footer__button group"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>{text.adviceCta}</span>
              <span className="edio-footer__button-icon" aria-hidden="true">
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </a>
            <p className="edio-footer__trust">{text.trustLine}</p>
          </section>
        </div>

        <div className="edio-footer__bottom">
          <p>{text.legal.copyright.replace("{{year}}", String(year))}</p>
          <nav aria-label={lang === "ar" ? "روابط قانونية" : "Legal links"}>
            {legalLinks.map((link) => (
              <FooterInlineLink key={`${link.label}-${link.to}`} link={link} isCurrent={isCurrent(link.to)} />
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterGroupLinks({ group, isCurrent }: { group: FooterGroup; isCurrent: (to: string) => boolean }) {
  return (
    <section>
      <h2 className="label-tech">{group.title}</h2>
      <FooterLinkList links={group.links} isCurrent={isCurrent} />
    </section>
  );
}

function FooterLinkList({ links, isCurrent }: { links: FooterLink[]; isCurrent: (to: string) => boolean }) {
  return (
    <ul>
      {links.map((link) => (
        <li key={`${link.label}-${link.to}`}>
          <FooterInlineLink link={link} isCurrent={isCurrent(link.to)} />
        </li>
      ))}
    </ul>
  );
}

function FooterInlineLink({ link, isCurrent }: { link: FooterLink; isCurrent: boolean }) {
  const className = cn("edio-footer__link", isCurrent && "is-current");

  if (link.external) {
    return (
      <a href={link.to} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <Link to={link.to} className={className} aria-current={isCurrent ? "page" : undefined}>
      {link.label}
    </Link>
  );
}
