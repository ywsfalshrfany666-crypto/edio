import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import logo7hz from "@/assets/brands/white/7hz-white.png";
import logoAful from "@/assets/brands/white/aful-white.png";
import logoAudioTechnica from "@/assets/brands/audio-technica.svg";
import logoBlon from "@/assets/brands/white/blon-white.png";
import logoDunu from "@/assets/brands/white/dunu-white.png";
import logoFiio from "@/assets/brands/white/fiio-white.png";
import logoFosiAudio from "@/assets/brands/white/fosi-audio-white.png";
import logoHarmonicEmpire from "@/assets/brands/white/harmonic-empire-white.png";
import logoHarmonicdyne from "@/assets/brands/white/harmonicdyne-white.png";
import logoHifiman from "@/assets/brands/white/hifiman-official-white.png";
import logoHiby from "@/assets/brands/white/hiby-white.png";
import logoJcally from "@/assets/brands/white/jcally-white.png";
import logoKefine from "@/assets/brands/white/kefine-white.png";
import logoKinera from "@/assets/brands/white/kinera-official-white.png";
import logoKiwiEars from "@/assets/brands/white/kiwi-ears-white.png";
import logoLetshuoer from "@/assets/brands/white/letshuoer-white.png";
import logoMoondrop from "@/assets/brands/white/moondrop-white.png";
import logoPhilips from "@/assets/brands/philips.svg";
import logoRoseselsa from "@/assets/brands/white/roseselsa-official-white.png";
import logoSennheiser from "@/assets/brands/white/sennheiser-white.png";
import logoSimgot from "@/assets/brands/white/simgot-white.png";
import logoSivga from "@/assets/brands/white/sivga-official-white.png";
import logoSpinfit from "@/assets/brands/white/spinfit-white.png";
import logoTangzu from "@/assets/brands/white/tangzu-official-white.png";
import logoTripowin from "@/assets/brands/white/tripowin-white.png";
import logoTrn from "@/assets/brands/white/trn-white.png";
import logoTruthear from "@/assets/brands/truthear-official.svg";
import logoTwistura from "@/assets/brands/white/twistura-official-white.png";
import logoZiigaat from "@/assets/brands/ziigaat.svg";
import logoPulaAudio from "@/assets/brands/pula-audio.svg";

type BrandItem = { name: string; brand?: string; src?: string; wide?: boolean };

const brandItems: BrandItem[] = [
  { name: "7Hz", brand: "7hz", src: logo7hz },
  { name: "AFUL", src: logoAful },
  { name: "AKG" },
  { name: "Audio-Technica", brand: "AUDIO TECHNICA", src: logoAudioTechnica },
  { name: "Binary" },
  { name: "BLON", brand: "Blon", src: logoBlon },
  { name: "DUNU", src: logoDunu },
  { name: "FiiO", src: logoFiio },
  { name: "Fosi Audio", src: logoFosiAudio, wide: true },
  { name: "Harmonic Empire", src: logoHarmonicEmpire },
  { name: "HarmonicDyne", src: logoHarmonicdyne },
  { name: "HiFiMan", src: logoHifiman, wide: true },
  { name: "HiBy", brand: "Hiby", src: logoHiby },
  { name: "JCALLY", src: logoJcally },
  { name: "KEFINE", src: logoKefine },
  { name: "Kinera", src: logoKinera, wide: true },
  { name: "Kiwi Ears", src: logoKiwiEars },
  { name: "LETSHUOER", src: logoLetshuoer },
  { name: "Moondrop", brand: "MOONDROP", src: logoMoondrop },
  { name: "Philips", src: logoPhilips },
  { name: "ROSESELSA", src: logoRoseselsa },
  { name: "Sennheiser", src: logoSennheiser },
  { name: "SIMGOT", src: logoSimgot },
  { name: "Sivga", src: logoSivga, wide: true },
  { name: "SpinFit", src: logoSpinfit },
  { name: "Tanchjim", wide: true },
  { name: "Tangzu", src: logoTangzu },
  { name: "Tripowin", src: logoTripowin },
  { name: "TRN", src: logoTrn },
  { name: "TRUTHEAR", src: logoTruthear },
  { name: "Twistura", src: logoTwistura, wide: true },
  { name: "ZiiGaat", src: logoZiigaat },
  { name: "Pula Audio", src: logoPulaAudio },
];

export function BrandStrip() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language.startsWith("ar");

  return (
    <section
      data-header-surface="dark"
      dir={isArabic ? "rtl" : "ltr"}
      className="section-luxury overflow-hidden bg-surface-lowest py-12"
    >
      <div className="container-edio mb-7">
        <p className="label-tech text-primary/85">{t("brands.eyebrow")}</p>
      </div>
      <div className="brand-marquee-viewport relative overflow-hidden py-3" dir="ltr">
        <div className="pointer-events-none absolute inset-y-0 start-0 z-10 w-16 bg-gradient-to-r from-surface-lowest to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 end-0 z-10 w-16 bg-gradient-to-l from-surface-lowest to-transparent sm:w-28" />
        <div className="brand-marquee" aria-label={t("brands.eyebrow")}>
          {[0, 1].map((groupIndex) => (
            <div key={groupIndex} className="brand-marquee__group" aria-hidden={groupIndex === 1}>
              {brandItems.map((b, index) => {
                const brand = b.brand ?? b.name;
                const duplicated = groupIndex === 1;
                const priorityLogo = groupIndex === 0 && index < 8;

                return (
                  <Link
                    key={`${b.name}-${groupIndex}-${index}`}
                    to={`/shop?brand=${encodeURIComponent(brand)}`}
                    title={b.name}
                    className="group/brand premium-ghost flex h-20 w-[150px] shrink-0 items-center justify-center outline-none sm:w-[190px] lg:w-[210px]"
                    aria-hidden={duplicated}
                    tabIndex={duplicated ? -1 : undefined}
                  >
                    {b.src ? (
                      <img
                        src={b.src}
                        alt={b.name}
                        className={`w-auto object-contain opacity-90 transition-[opacity,transform] duration-300 [filter:brightness(0)_invert(1)] group-hover/brand:opacity-100 group-hover/brand:scale-[1.02] group-focus-visible/brand:opacity-100 ${
                          b.wide ? "max-h-14 max-w-[200px]" : "max-h-16 max-w-[168px]"
                        }`}
                        width={b.wide ? 200 : 168}
                        height={64}
                        loading={priorityLogo ? "eager" : "lazy"}
                        decoding="async"
                      />
                    ) : (
                      <span
                        dir="auto"
                        className="font-display text-lg font-bold tracking-normal text-foreground/90 transition-colors group-hover/brand:text-foreground group-focus-visible/brand:text-foreground sm:text-xl"
                      >
                        {b.name}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
