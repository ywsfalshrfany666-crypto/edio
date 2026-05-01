// Centralized brand logo map. Keys match `Product.brand` values from catalog.
// Brands without a logo asset render as styled text fallback.

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
import logoSmsl from "@/assets/brands/white/smsl-white.png";
import logoSpinfit from "@/assets/brands/white/spinfit-white.png";
import logoTanchjim from "@/assets/brands/tanchjim-official.png";
import logoTangzu from "@/assets/brands/white/tangzu-official-white.png";
import logoTripowin from "@/assets/brands/white/tripowin-white.png";
import logoTrn from "@/assets/brands/white/trn-white.png";
import logoTruthear from "@/assets/brands/truthear-official.svg";
import logoTwistura from "@/assets/brands/white/twistura-official-white.png";
import logoZiigaat from "@/assets/brands/ziigaat.svg";
import logoPulaAudio from "@/assets/brands/pula-audio.svg";

// Normalize brand strings to a lookup key
const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "");

const map: Record<string, string> = {
  [norm("7Hz")]: logo7hz,
  [norm("AFUL")]: logoAful,
  [norm("Audio-Technica")]: logoAudioTechnica,
  [norm("BLON")]: logoBlon,
  [norm("DUNU")]: logoDunu,
  [norm("FiiO")]: logoFiio,
  [norm("Fosi Audio")]: logoFosiAudio,
  [norm("Harmonic Empire")]: logoHarmonicEmpire,
  [norm("HarmonicDyne")]: logoHarmonicdyne,
  [norm("HiFiMan")]: logoHifiman,
  [norm("HiBy")]: logoHiby,
  [norm("JCALLY")]: logoJcally,
  [norm("KEFINE")]: logoKefine,
  [norm("Kinera")]: logoKinera,
  [norm("Kiwi Ears")]: logoKiwiEars,
  [norm("LETSHUOER")]: logoLetshuoer,
  [norm("Moondrop")]: logoMoondrop,
  [norm("Philips")]: logoPhilips,
  [norm("ROSESELSA")]: logoRoseselsa,
  [norm("Sennheiser")]: logoSennheiser,
  [norm("SIMGOT")]: logoSimgot,
  [norm("Sivga")]: logoSivga,
  [norm("SMSL")]: logoSmsl,
  [norm("SpinFit")]: logoSpinfit,
  [norm("Tanchjim")]: logoTanchjim,
  [norm("Tangzu")]: logoTangzu,
  [norm("Tripowin")]: logoTripowin,
  [norm("TRN")]: logoTrn,
  [norm("TRUTHEAR")]: logoTruthear,
  [norm("Twistura")]: logoTwistura,
  [norm("ZiiGaat")]: logoZiigaat,
  [norm("Pula Audio")]: logoPulaAudio,
};

export function getBrandLogo(brand: string): string | undefined {
  return map[norm(brand)];
}
