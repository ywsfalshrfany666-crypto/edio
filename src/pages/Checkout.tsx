import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Lock,
  Check,
  Banknote,
  Copy,
  CreditCard,
  MessageCircle,
  Truck,
  Headphones,
  MapPinned,
  WalletCards,
  Tag,
  X,
  AlertCircle,
  ShieldCheck,
  PhoneCall,
  Phone,
  Mail,
  MapPin,
  User,
  ArrowLeft,
  ArrowRight,
  Package,
  Sparkles,
  ShoppingBag,
  Home,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { useCart } from "@/store/cart";
import { useCurrency } from "@/store/currency";
import { formatPrice } from "@/data/catalog";
import { getCartDiscount } from "@/lib/cartPricing";
import { toast } from "sonner";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";
import {
  buildEdioOrderDraft,
  submitEdioOrder,
  validateEdioOrderDraft,
  type EdioOrderFieldErrors,
  type EdioOrderSubmissionResult,
} from "@/lib/edioOrder";
import {
  buildAlwaseetCheckoutDraft,
  fetchAlwaseetLookups,
  submitAlwaseetOrder,
  validateAlwaseetCheckoutDraft,
  type AlwaseetCheckoutDraft,
  type AlwaseetLookupOption,
  type AlwaseetSubmissionResult,
} from "@/lib/alwaseet";

const FREE_SHIPPING_THRESHOLD = 150000;
const SHIPPING_FEE = 5000;
const QI_CARD_NUMBER = "7139950153";
const EDIO_WHATSAPP_NUMBER = "9647702046674";

const IRAQ_GOVERNORATES = [
  { code: "baghdad", label: { en: "Baghdad", ar: "بغداد" } },
  { code: "basra", label: { en: "Basra", ar: "البصرة" } },
  { code: "nineveh", label: { en: "Nineveh", ar: "نينوى" } },
  { code: "erbil", label: { en: "Erbil", ar: "أربيل" } },
  { code: "sulaymaniyah", label: { en: "Sulaymaniyah", ar: "السليمانية" } },
  { code: "duhok", label: { en: "Duhok", ar: "دهوك" } },
  { code: "kirkuk", label: { en: "Kirkuk", ar: "كركوك" } },
  { code: "najaf", label: { en: "Najaf", ar: "النجف" } },
  { code: "karbala", label: { en: "Karbala", ar: "كربلاء" } },
  { code: "dhiqar", label: { en: "Dhi Qar", ar: "ذي قار" } },
  { code: "maysan", label: { en: "Maysan", ar: "ميسان" } },
  { code: "muthanna", label: { en: "Muthanna", ar: "المثنى" } },
  { code: "qadisiyah", label: { en: "Al-Qadisiyah", ar: "القادسية" } },
  { code: "babil", label: { en: "Babil", ar: "بابل" } },
  { code: "wasit", label: { en: "Wasit", ar: "واسط" } },
  { code: "diyala", label: { en: "Diyala", ar: "ديالى" } },
  { code: "anbar", label: { en: "Anbar", ar: "الأنبار" } },
  { code: "salahaddin", label: { en: "Salah al-Din", ar: "صلاح الدين" } },
] as const;

type GovernorateCode = (typeof IRAQ_GOVERNORATES)[number]["code"];
type LocalizedLabel = { en: string; ar: string };
type RegionSuggestion = { code: string; label: LocalizedLabel; keywords?: readonly string[] };

const IRAQ_REGIONS_BY_GOVERNORATE: Record<GovernorateCode, readonly RegionSuggestion[]> = {
  baghdad: [
    { code: "karrada", label: { en: "Karrada", ar: "الكرادة" }, keywords: ["كرادة"] },
    { code: "mansour", label: { en: "Mansour", ar: "المنصور" }, keywords: ["منصور"] },
    { code: "zayouna", label: { en: "Zayouna", ar: "زيونة" }, keywords: ["زيونه"] },
    { code: "jadriya", label: { en: "Jadriya", ar: "الجادرية" }, keywords: ["جادريه"] },
    { code: "adhamiyah", label: { en: "Adhamiyah", ar: "الأعظمية" }, keywords: ["اعظمية", "الاعظمية"] },
    { code: "kadhimiyah", label: { en: "Kadhimiyah", ar: "الكاظمية" }, keywords: ["كاظمية"] },
    { code: "sadr-city", label: { en: "Sadr City", ar: "مدينة الصدر" }, keywords: ["الصدر"] },
    { code: "palestine-street", label: { en: "Palestine Street", ar: "شارع فلسطين" }, keywords: ["فلسطين"] },
    { code: "dora", label: { en: "Dora", ar: "الدورة" }, keywords: ["دورة"] },
    { code: "yarmouk", label: { en: "Yarmouk", ar: "اليرموك" }, keywords: ["يرموك"] },
    { code: "harithiya", label: { en: "Al-Harithiya", ar: "الحارثية" }, keywords: ["حارثية"] },
    { code: "ghazaliya", label: { en: "Al-Ghazaliya", ar: "الغزالية" }, keywords: ["غزالية"] },
    { code: "new-baghdad", label: { en: "New Baghdad", ar: "بغداد الجديدة" }, keywords: ["بغداد الجديدة"] },
    { code: "bayaa", label: { en: "Al-Bayaa", ar: "البياع" }, keywords: ["بياع"] },
    { code: "saydiya", label: { en: "Al-Saydiya", ar: "السيدية" }, keywords: ["سيدية"] },
  ],
  basra: [
    { code: "ashar", label: { en: "Al-Ashar", ar: "العشار" }, keywords: ["عشار"] },
    { code: "bradhiya", label: { en: "Al-Bradhiya", ar: "البراضعية" }, keywords: ["براضعية"] },
    { code: "jubaila", label: { en: "Al-Jubaila", ar: "الجبيلة" }, keywords: ["جبيلة"] },
    { code: "maqal", label: { en: "Al-Maqal", ar: "المعقل" }, keywords: ["معقل"] },
    { code: "tanuma", label: { en: "Al-Tanuma", ar: "التنومة" }, keywords: ["تنومة"] },
    { code: "hartha", label: { en: "Al-Hartha", ar: "الهارثة" }, keywords: ["هارثة"] },
    { code: "abu-alkhaseeb", label: { en: "Abu Al-Khaseeb", ar: "أبو الخصيب" }, keywords: ["ابو الخصيب"] },
    { code: "zubair", label: { en: "Al-Zubair", ar: "الزبير" }, keywords: ["زبير"] },
    { code: "qurna", label: { en: "Al-Qurna", ar: "القرنة" }, keywords: ["قرنة"] },
    { code: "shatt-alarab", label: { en: "Shatt Al-Arab", ar: "شط العرب" }, keywords: ["شط العرب"] },
    { code: "faw", label: { en: "Al-Faw", ar: "الفاو" }, keywords: ["فاو"] },
    { code: "safwan", label: { en: "Safwan", ar: "سفوان" }, keywords: ["سفوان"] },
  ],
  nineveh: [
    { code: "mosul", label: { en: "Mosul", ar: "الموصل" }, keywords: ["موصل"] },
    { code: "left-coast", label: { en: "Left Coast", ar: "الساحل الأيسر" }, keywords: ["ايسر", "الأيسر"] },
    { code: "right-coast", label: { en: "Right Coast", ar: "الساحل الأيمن" }, keywords: ["ايمن", "الأيمن"] },
    { code: "hammam-alalil", label: { en: "Hammam Al-Alil", ar: "حمام العليل" } },
    { code: "tal-afar", label: { en: "Tal Afar", ar: "تلعفر" } },
    { code: "hamdaniya", label: { en: "Al-Hamdaniya", ar: "الحمدانية" } },
  ],
  erbil: [
    { code: "ankawa", label: { en: "Ankawa", ar: "عنكاوا" } },
    { code: "bahirka", label: { en: "Bahirka", ar: "بحركة" } },
    { code: "shaqlawa", label: { en: "Shaqlawa", ar: "شقلاوة" } },
    { code: "koya", label: { en: "Koya", ar: "كويسنجق" }, keywords: ["كويسنجق", "كوية"] },
    { code: "soran", label: { en: "Soran", ar: "سوران" } },
  ],
  sulaymaniyah: [
    { code: "salim-street", label: { en: "Salim Street", ar: "شارع سالم" } },
    { code: "bakrajo", label: { en: "Bakrajo", ar: "بكرجو" } },
    { code: "raparin", label: { en: "Raparin", ar: "رابرين" } },
    { code: "chamchamal", label: { en: "Chamchamal", ar: "جمجمال" } },
    { code: "halabja", label: { en: "Halabja", ar: "حلبجة" } },
  ],
  duhok: [
    { code: "duhok-center", label: { en: "Duhok Center", ar: "مركز دهوك" } },
    { code: "zakho", label: { en: "Zakho", ar: "زاخو" } },
    { code: "simele", label: { en: "Simele", ar: "سيميل" } },
    { code: "akre", label: { en: "Akre", ar: "عقرة" } },
  ],
  kirkuk: [
    { code: "kirkuk-center", label: { en: "Kirkuk Center", ar: "مركز كركوك" } },
    { code: "rahimawa", label: { en: "Rahimawa", ar: "رحيم آوة" } },
    { code: "shorija", label: { en: "Shorija", ar: "شورجة" } },
    { code: "dibis", label: { en: "Dibis", ar: "دبس" } },
  ],
  najaf: [
    { code: "najaf-center", label: { en: "Najaf Center", ar: "مركز النجف" } },
    { code: "kufa", label: { en: "Kufa", ar: "الكوفة" } },
    { code: "haydariya", label: { en: "Al-Haydariya", ar: "الحيدرية" } },
    { code: "manathera", label: { en: "Al-Manathera", ar: "المناذرة" } },
  ],
  karbala: [
    { code: "karbala-center", label: { en: "Karbala Center", ar: "مركز كربلاء" } },
    { code: "husseiniya", label: { en: "Al-Husseiniya", ar: "الحسينية" } },
    { code: "hindiyah", label: { en: "Al-Hindiyah", ar: "الهندية" } },
    { code: "ain-altamur", label: { en: "Ain Al-Tamur", ar: "عين التمر" } },
  ],
  dhiqar: [
    { code: "nasiriyah", label: { en: "Nasiriyah", ar: "الناصرية" } },
    { code: "shatra", label: { en: "Al-Shatra", ar: "الشطرة" } },
    { code: "suq-alshuyukh", label: { en: "Suq Al-Shuyukh", ar: "سوق الشيوخ" } },
    { code: "rifai", label: { en: "Al-Rifai", ar: "الرفاعي" } },
  ],
  maysan: [
    { code: "amara", label: { en: "Amarah", ar: "العمارة" } },
    { code: "majar", label: { en: "Al-Majar Al-Kabir", ar: "المجر الكبير" } },
    { code: "kumait", label: { en: "Kumait", ar: "الكميت" } },
    { code: "maymouna", label: { en: "Al-Maymouna", ar: "الميمونة" } },
  ],
  muthanna: [
    { code: "samawah", label: { en: "Samawah", ar: "السماوة" } },
    { code: "rumaytha", label: { en: "Al-Rumaytha", ar: "الرميثة" } },
    { code: "khidr", label: { en: "Al-Khidr", ar: "الخضر" } },
    { code: "salman", label: { en: "Al-Salman", ar: "السلمان" } },
  ],
  qadisiyah: [
    { code: "diwaniyah", label: { en: "Diwaniyah", ar: "الديوانية" } },
    { code: "afak", label: { en: "Afak", ar: "عفك" } },
    { code: "shamiya", label: { en: "Al-Shamiya", ar: "الشامية" } },
    { code: "hamza", label: { en: "Al-Hamza", ar: "الحمزة" } },
  ],
  babil: [
    { code: "hillah", label: { en: "Hillah", ar: "الحلة" } },
    { code: "iskandariya", label: { en: "Iskandariya", ar: "الإسكندرية" } },
    { code: "mahawil", label: { en: "Al-Mahawil", ar: "المحاويل" } },
    { code: "haswa", label: { en: "Al-Haswa", ar: "الحصوة" } },
  ],
  wasit: [
    { code: "kut", label: { en: "Kut", ar: "الكوت" } },
    { code: "numaniya", label: { en: "Al-Numaniya", ar: "النعمانية" } },
    { code: "aziziyah", label: { en: "Al-Aziziyah", ar: "العزيزية" } },
    { code: "hai", label: { en: "Al-Hai", ar: "الحي" } },
  ],
  diyala: [
    { code: "baqubah", label: { en: "Baqubah", ar: "بعقوبة" } },
    { code: "muqdadiya", label: { en: "Al-Muqdadiya", ar: "المقدادية" } },
    { code: "khalis", label: { en: "Al-Khalis", ar: "الخالص" } },
    { code: "khanaqin", label: { en: "Khanaqin", ar: "خانقين" } },
  ],
  anbar: [
    { code: "ramadi", label: { en: "Ramadi", ar: "الرمادي" } },
    { code: "fallujah", label: { en: "Fallujah", ar: "الفلوجة" } },
    { code: "hit", label: { en: "Hit", ar: "هيت" } },
    { code: "haditha", label: { en: "Haditha", ar: "حديثة" } },
    { code: "qaem", label: { en: "Al-Qaim", ar: "القائم" } },
  ],
  salahaddin: [
    { code: "tikrit", label: { en: "Tikrit", ar: "تكريت" } },
    { code: "samarra", label: { en: "Samarra", ar: "سامراء" } },
    { code: "balad", label: { en: "Balad", ar: "بلد" } },
    { code: "dujail", label: { en: "Dujail", ar: "الدجيل" } },
    { code: "baiji", label: { en: "Baiji", ar: "بيجي" } },
  ],
};

const COUNTRIES = [
  { code: "IQ", name: "Iraq", dial: "+964" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "KW", name: "Kuwait", dial: "+965" },
  { code: "QA", name: "Qatar", dial: "+974" },
  { code: "BH", name: "Bahrain", dial: "+973" },
  { code: "OM", name: "Oman", dial: "+968" },
  { code: "JO", name: "Jordan", dial: "+962" },
  { code: "LB", name: "Lebanon", dial: "+961" },
  { code: "SY", name: "Syria", dial: "+963" },
  { code: "TR", name: "Turkey", dial: "+90" },
  { code: "IR", name: "Iran", dial: "+98" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "BE", name: "Belgium", dial: "+32" },
  { code: "SE", name: "Sweden", dial: "+46" },
  { code: "NO", name: "Norway", dial: "+47" },
  { code: "DK", name: "Denmark", dial: "+45" },
  { code: "FI", name: "Finland", dial: "+358" },
  { code: "CH", name: "Switzerland", dial: "+41" },
  { code: "AT", name: "Austria", dial: "+43" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "PT", name: "Portugal", dial: "+351" },
  { code: "GR", name: "Greece", dial: "+30" },
  { code: "PL", name: "Poland", dial: "+48" },
  { code: "RO", name: "Romania", dial: "+40" },
  { code: "BG", name: "Bulgaria", dial: "+359" },
  { code: "CZ", name: "Czechia", dial: "+420" },
  { code: "HU", name: "Hungary", dial: "+36" },
  { code: "UA", name: "Ukraine", dial: "+380" },
  { code: "RU", name: "Russia", dial: "+7" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "PK", name: "Pakistan", dial: "+92" },
  { code: "BD", name: "Bangladesh", dial: "+880" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "DZ", name: "Algeria", dial: "+213" },
  { code: "TN", name: "Tunisia", dial: "+216" },
  { code: "LY", name: "Libya", dial: "+218" },
  { code: "SD", name: "Sudan", dial: "+249" },
  { code: "YE", name: "Yemen", dial: "+967" },
  { code: "IL", name: "Israel", dial: "+972" },
  { code: "PS", name: "Palestine", dial: "+970" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "PE", name: "Peru", dial: "+51" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "PA", name: "Panama", dial: "+507" },
  { code: "DO", name: "Dominican Republic", dial: "+1" },
  { code: "JM", name: "Jamaica", dial: "+1" },
  { code: "IS", name: "Iceland", dial: "+354" },
  { code: "LU", name: "Luxembourg", dial: "+352" },
  { code: "MT", name: "Malta", dial: "+356" },
  { code: "CY", name: "Cyprus", dial: "+357" },
  { code: "EE", name: "Estonia", dial: "+372" },
  { code: "LV", name: "Latvia", dial: "+371" },
  { code: "LT", name: "Lithuania", dial: "+370" },
  { code: "SK", name: "Slovakia", dial: "+421" },
  { code: "SI", name: "Slovenia", dial: "+386" },
  { code: "HR", name: "Croatia", dial: "+385" },
  { code: "RS", name: "Serbia", dial: "+381" },
  { code: "BA", name: "Bosnia and Herzegovina", dial: "+387" },
  { code: "ME", name: "Montenegro", dial: "+382" },
  { code: "MK", name: "North Macedonia", dial: "+389" },
  { code: "AL", name: "Albania", dial: "+355" },
  { code: "GE", name: "Georgia", dial: "+995" },
  { code: "AM", name: "Armenia", dial: "+374" },
  { code: "AZ", name: "Azerbaijan", dial: "+994" },
  { code: "KZ", name: "Kazakhstan", dial: "+7" },
  { code: "UZ", name: "Uzbekistan", dial: "+998" },
  { code: "AF", name: "Afghanistan", dial: "+93" },
  { code: "LK", name: "Sri Lanka", dial: "+94" },
  { code: "NP", name: "Nepal", dial: "+977" },
  { code: "MM", name: "Myanmar", dial: "+95" },
  { code: "KH", name: "Cambodia", dial: "+855" },
  { code: "LA", name: "Laos", dial: "+856" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "MO", name: "Macao", dial: "+853" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "CI", name: "Côte d’Ivoire", dial: "+225" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "MU", name: "Mauritius", dial: "+230" },
] as const;

function countryFlagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function formatPhoneForCountry(countryCode: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2).replace(/\D/g, "")}`;
  const country = COUNTRIES.find((item) => item.code === countryCode) || COUNTRIES[0];
  const national = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  return national ? `${country.dial}${national}` : "";
}

function normalizeOptionSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}+]+/gu, " ")
    .trim();
}

type SearchableOption = {
  value: string;
  label: string;
  keywords?: readonly string[];
};

const Checkout = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const isArabic = lang === "ar";
  const currency = useCurrency((s) => s.currency);
  const navigate = useNavigate();
  const rawItems = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const coupon = useCart((s) => s.coupon);
  const applyCoupon = useCart((s) => s.applyCoupon);
  const removeCoupon = useCart((s) => s.removeCoupon);
  const { products } = useRuntimeCatalog();
  const items = useMemo(
    () =>
      rawItems
        .map((item) => {
          const product = products.find((p) => p.id === item.id);
          return product ? { ...item, product } : null;
        })
        .filter((item): item is (typeof rawItems)[number] & { product: (typeof products)[number] } => item !== null),
    [products, rawItems],
  );
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [items]);
  const discount = useMemo(() => getCartDiscount(subtotal, coupon), [coupon, subtotal]);

  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Customer form state
  const [phone, setPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("IQ");
  const [secondaryPhoneCountry, setSecondaryPhoneCountry] = useState("IQ");
  const [firstName, setFirstName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [packageSize, setPackageSize] = useState("");
  const [nearestPoint, setNearestPoint] = useState("");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<EdioOrderFieldErrors>({});
  const [packageSizeError, setPackageSizeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"qi_card" | "cod">("qi_card");
  const [alwaseetCities, setAlwaseetCities] = useState<AlwaseetLookupOption[]>([]);
  const [alwaseetRegions, setAlwaseetRegions] = useState<AlwaseetLookupOption[]>([]);
  const [alwaseetPackageSizes, setAlwaseetPackageSizes] = useState<AlwaseetLookupOption[]>([]);
  const [shippingOptionsLoading, setShippingOptionsLoading] = useState(true);
  const [regionsLoading, setRegionsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setShippingOptionsLoading(true);

    fetchAlwaseetLookups()
      .then((lookups) => {
        if (!active) return;
        setAlwaseetCities(lookups.cities);
        setAlwaseetPackageSizes(lookups.packageSizes);
      })
      .catch(() => {
        if (!active) return;
        setAlwaseetCities([]);
        setAlwaseetPackageSizes([]);
      })
      .finally(() => {
        if (active) setShippingOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!alwaseetPackageSizes.length) {
      setPackageSize("");
      return;
    }
    if (!alwaseetPackageSizes.some((option) => String(option.id) === packageSize)) {
      setPackageSize(String(alwaseetPackageSizes[0].id));
    }
  }, [alwaseetPackageSizes, packageSize]);

  useEffect(() => {
    let active = true;
    setAlwaseetRegions([]);

    const cityId = Number(city);
    if (!alwaseetCities.length || !Number.isFinite(cityId) || cityId <= 0) {
      setRegionsLoading(false);
      return () => {
        active = false;
      };
    }

    setRegionsLoading(true);
    fetchAlwaseetLookups(cityId)
      .then((lookups) => {
        if (!active) return;
        setAlwaseetRegions(lookups.regions);
      })
      .catch(() => {
        if (!active) return;
        setAlwaseetRegions([]);
      })
      .finally(() => {
        if (active) setRegionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [alwaseetCities.length, city]);

  const governorateOptions = useMemo(
    () => {
      if (alwaseetCities.length) {
        return alwaseetCities.map((cityOption) => ({
          value: String(cityOption.id),
          label: cityOption.label,
          keywords: [cityOption.label, String(cityOption.id)],
        }));
      }

      return IRAQ_GOVERNORATES.map((governorate) => ({
        value: governorate.code,
        label: governorate.label[lang],
        keywords: [governorate.label.en, governorate.label.ar, governorate.code],
      }));
    },
    [alwaseetCities, lang],
  );
  const regionOptions = useMemo(() => {
    if (!city) return [];
    if (alwaseetCities.length) {
      return alwaseetRegions.map((regionItem) => ({
        value: String(regionItem.id),
        label: regionItem.label,
        keywords: [regionItem.label, String(regionItem.id)],
      }));
    }

    const regions = IRAQ_REGIONS_BY_GOVERNORATE[city as GovernorateCode] ?? [];
    return regions.map((regionItem) => ({
      value: regionItem.label[lang],
      label: regionItem.label[lang],
      keywords: [regionItem.label.en, regionItem.label.ar, regionItem.code, ...(regionItem.keywords ?? [])],
    }));
  }, [alwaseetCities.length, alwaseetRegions, city, lang]);
  const selectedCityOption = useMemo(
    () => governorateOptions.find((option) => option.value === city),
    [city, governorateOptions],
  );
  const selectedRegionOption = useMemo(
    () => regionOptions.find((option) => option.value === region),
    [region, regionOptions],
  );
  const packageSizeOptions = useMemo(
    () =>
      alwaseetPackageSizes.map((sizeOption) => ({
        value: String(sizeOption.id),
        label: sizeOption.label,
        keywords: [sizeOption.label, String(sizeOption.id)],
      })),
    [alwaseetPackageSizes],
  );

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (trimmed.length > 32) {
      setCouponFeedback({ type: "error", message: "Code too long" });
      return;
    }
    const result = applyCoupon(trimmed, subtotal);
    if (result.ok) {
      setCouponFeedback({ type: "success", message: `${result.coupon.code} applied` });
      setCode("");
      setShowCouponInput(false);
      setTimeout(() => setCouponFeedback(null), 3000);
      return;
    }
    const errCode = (result as { ok: false; error: "invalid" | "minSubtotal" }).error;
    setCouponFeedback({
      type: "error",
      message: errCode === "invalid" ? "Invalid coupon code" : "Subtotal too low for this code",
    });
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponFeedback(null);
  };

  if (items.length === 0) return <Navigate to="/shop" replace />;

  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = afterDiscount + shipping;
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount);
  const freeProgress = Math.min(100, (afterDiscount / FREE_SHIPPING_THRESHOLD) * 100);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormErrors({});
    setPackageSizeError(undefined);
    setSubmitting(true);
    const orderId = `EDIO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const selectedGovernorate = IRAQ_GOVERNORATES.find((item) => item.code === city);
    const provinceLabel = selectedCityOption?.label || selectedGovernorate?.label[lang] || city;
    const regionLabel = selectedRegionOption?.label || region;
    const orderDraft = buildEdioOrderDraft({
      orderNumber: orderId,
      customerName: firstName.trim(),
      customerEmail: email.trim() || undefined,
      primaryPhone: formatPhoneForCountry(phoneCountry, phone),
      secondaryPhone: secondaryPhone.trim() ? formatPhoneForCountry(secondaryPhoneCountry, secondaryPhone) : undefined,
      province: provinceLabel,
      region: regionLabel,
      nearestPoint,
      fullAddress: address,
      notes,
      items,
      subtotal,
      discount,
      deliveryPrice: shipping,
      totalPrice: total,
      paymentMethod,
      paymentReference: paymentMethod === "qi_card" ? QI_CARD_NUMBER : undefined,
    });
    const validation = validateEdioOrderDraft(orderDraft);
    if (!validation.ok) {
      setFormErrors(validation.errors);
      setFormError(
        Object.values(validation.errors)[0] ||
              (isArabic ? "أكمل بيانات الشحن قبل إرسال الطلب." : "Complete the delivery details before placing the order."),
      );
      setSubmitting(false);
      return;
    }

    if (!alwaseetCities.length || !alwaseetPackageSizes.length) {
      setFormError(isArabic ? "تعذر تحميل حقول الوسيط المطلوبة. أعد المحاولة بعد لحظات." : "Required Alwaseet fields could not load. Try again shortly.");
      setSubmitting(false);
      return;
    }

    const alwaseetDraft: AlwaseetCheckoutDraft = buildAlwaseetCheckoutDraft({
      edioOrderId: orderId,
      customerName: firstName.trim(),
      primaryPhone: formatPhoneForCountry(phoneCountry, phone),
      secondaryPhone: secondaryPhone.trim() ? formatPhoneForCountry(secondaryPhoneCountry, secondaryPhone) : undefined,
      cityId: Number(city),
      regionId: Number(region),
      packageSizeId: Number(packageSize),
      province: provinceLabel,
      provinceArabic: selectedCityOption?.label,
      region: regionLabel,
      nearestPoint,
      fullAddress: address,
      notes,
      items,
      subtotal,
      discount,
      deliveryPrice: shipping,
      totalPrice: total,
    });
    const alwaseetValidation = validateAlwaseetCheckoutDraft(alwaseetDraft);
    if (!alwaseetValidation.ok) {
      if (alwaseetValidation.errors.packageSizeId) setPackageSizeError(alwaseetValidation.errors.packageSizeId);
      setFormErrors((current) => ({
        ...current,
        customerName: alwaseetValidation.errors.customerName || current.customerName,
        primaryPhone: alwaseetValidation.errors.primaryPhone || current.primaryPhone,
        province: alwaseetValidation.errors.province || alwaseetValidation.errors.cityId || current.province,
        region: alwaseetValidation.errors.region || alwaseetValidation.errors.regionId || current.region,
        items: alwaseetValidation.errors.items || current.items,
        totalPrice: alwaseetValidation.errors.totalPrice || current.totalPrice,
      }));
      setFormError(Object.values(alwaseetValidation.errors)[0] || (isArabic ? "أكمل حقول الوسيط المطلوبة." : "Complete the required Alwaseet fields."));
      setSubmitting(false);
      return;
    }

    let orderSubmission: EdioOrderSubmissionResult;
    try {
      orderSubmission = await submitEdioOrder(orderDraft);
    } catch {
      orderSubmission = {
        ok: false,
        status: "failed",
        orderId,
        message: "تعذر حفظ الطلب حالياً. حاول مرة أخرى.",
        backend: "supabase",
        alwaseetDisabled: true,
      };
    }

    if (!orderSubmission.ok) {
      setFormError(orderSubmission.message);
      toast.error(orderSubmission.message);
      setSubmitting(false);
      return;
    }

    let alwaseetSubmission: AlwaseetSubmissionResult | undefined;
    try {
      alwaseetSubmission = await submitAlwaseetOrder(alwaseetDraft);
      if (!alwaseetSubmission.ok) {
        toast.error(alwaseetSubmission.message);
      }
    } catch {
      alwaseetSubmission = {
        ok: false,
        dryRun: true,
        status: "failed",
        edioOrderId: orderId,
        message: "تعذر إرسال بيانات الشحن إلى الوسيط حالياً.",
      };
      toast.error(alwaseetSubmission.message);
    }

    const snapshot = {
      orderId,
      placedAt: new Date().toISOString(),
      items: rawItems,
      subtotal,
      discount,
      shipping,
      total,
      customer: {
        firstName: firstName || undefined,
        email: email.trim() || undefined,
        phone: orderDraft.primaryPhone || undefined,
        secondaryPhone: orderDraft.secondaryPhone || undefined,
        address: address || undefined,
        city: provinceLabel || undefined,
        region: regionLabel || undefined,
        nearestPoint: nearestPoint || undefined,
        notes: notes || undefined,
      },
      orderSubmission,
      alwaseetSubmission,
      paymentMethod,
      etaDays: [2, 4] as [number, number],
    };
    toast.success(alwaseetSubmission?.ok ? alwaseetSubmission.message : orderSubmission.message || t("checkout.success"));
    clear();
    navigate("/order-confirmation", { state: snapshot, replace: true });
  };

  return (
    <Layout>
      <Seo title="Checkout" description="Complete your edio order securely." />
      {/* Editorial header band */}
      <section data-header-surface="dark" className="relative pt-28 md:pt-32 pb-12 border-b border-border/30 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 500px at 15% -10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(900px 500px at 95% 10%, hsl(var(--primary) / 0.10), transparent 65%), linear-gradient(180deg, hsl(var(--surface-high)) 0%, hsl(var(--surface-low)) 60%, hsl(var(--background)) 100%)",
          }}
          aria-hidden
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
          aria-hidden
        />
        {/* Floating glow orb */}
        <div
          className="absolute -top-24 right-1/3 -z-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)" }}
          aria-hidden
        />
        <div className="container-edio relative">
          <div className="flex items-center justify-between gap-6 mb-8">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("cta.continueShopping")}
            </Link>
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" />
              <span>Secure Checkout</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="label-tech mb-3 text-primary">Step 02 / 03 — Details</p>
              <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-normal leading-[0.92]">
                {t("checkout.title")}
              </h1>
              <p className="mt-4 text-base text-muted-foreground max-w-md">
                Just a few details and your order is on its way across Iraq.
              </p>
            </div>

            {/* Delivery Journey — creative tracker */}
            <div className="w-full md:w-[360px] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="label-tech text-primary">Your Order's Journey</span>
                <span className="text-[10px] font-mono text-muted-foreground">ETA · 2–4 days</span>
              </div>

              <div className="relative bg-surface-low p-5 overflow-hidden">
                {/* Dashed road */}
                <div
                  className="absolute left-7 right-7 top-1/2 -translate-y-1/2 h-px"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, hsl(var(--border) / 0.8) 0 6px, transparent 6px 12px)",
                  }}
                  aria-hidden
                />
                {/* Filled progress (Cart -> Details) */}
                <div className="absolute left-7 top-1/2 -translate-y-1/2 h-px bg-primary w-[calc(50%-1.75rem)]" aria-hidden />

                {/* Animated truck */}
                <div
	                  className="absolute top-1/2 -mt-3 -translate-y-1/2 transition-transform duration-200"
                  style={{ left: "calc(50% - 0.75rem)" }}
                  aria-hidden
                >
                  <div className="relative">
                    <Truck className="h-5 w-5 text-primary animate-pulse" />
                    <span className="absolute -inset-2 rounded-full bg-primary/20 blur-md animate-pulse" />
                  </div>
                </div>

                {/* Stops */}
                <ol className="relative flex items-center justify-between">
                  {[
                    { icon: ShoppingBag, label: "Cart", status: "done" as const },
                    { icon: MapPin, label: "Details", status: "active" as const },
                    { icon: Home, label: "Doorstep", status: "pending" as const },
                  ].map((stop) => (
                    <li key={stop.label} className="flex flex-col items-center gap-2">
                      <span
                        className={`relative z-10 inline-flex h-9 w-9 items-center justify-center border smooth ${
                          stop.status === "done"
                            ? "bg-foreground border-foreground text-background"
                            : stop.status === "active"
                              ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-surface-low border-border/60 text-muted-foreground"
                        }`}
                      >
                        {stop.status === "done" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <stop.icon className="h-4 w-4" />
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-widest ${
                          stop.status === "active" ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {stop.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="bg-background pb-32 md:pb-24">
        <div className="container-edio pt-10 md:pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            {/* Form column */}
            <form onSubmit={onSubmit} className="space-y-6 md:space-y-8">
              {/* Contact card */}
              <Card
                icon={PhoneCall}
                number="01"
                title={t("checkout.contact")}
                hint={isArabic ? "فريق edio يتواصل معك لتأكيد الطلب." : "edio support confirms your delivery details."}
              >
                <PhoneInput
                  label={isArabic ? "رقم الهاتف" : "Phone"}
                  lang={lang}
                  countryCode={phoneCountry}
                  onCountryChange={setPhoneCountry}
                  required
	                  placeholder="7XX XXX XXXX"
	                  value={phone}
	                  onChange={(e) => setPhone(e.target.value)}
                    error={formErrors.primaryPhone}
	                />
                <div className="mt-4">
                  <PhoneInput
                    label={isArabic ? "هاتف ثانوي (اختياري)" : "Secondary phone (optional)"}
                    lang={lang}
                    countryCode={secondaryPhoneCountry}
                    onCountryChange={setSecondaryPhoneCountry}
                    placeholder="7XX XXX XXXX"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                  />
                </div>
                <div className="mt-4">
                  <Input
                    icon={Mail}
                    label={isArabic ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={formErrors.customerEmail}
                  />
                </div>
	              </Card>

              {/* Shipping card */}
              <Card
                icon={MapPinned}
                number="02"
                title={t("checkout.shipping")}
                hint={isArabic ? "اختر المحافظة والمنطقة، ويمكننا تأكيد التفاصيل هاتفياً." : "Choose the governorate and region; extra details can be confirmed by phone."}
              >
	                <div className="space-y-4">
	                  <Input icon={User} label={isArabic ? "الاسم" : "Name"} required value={firstName} onChange={(e) => setFirstName(e.target.value)} error={formErrors.customerName} />
		                  <SearchableSelect
                        label={isArabic ? "المحافظة" : "Governorate"}
                        required
                        value={city}
                        onChange={(value) => {
                          setCity(value);
                          setRegion("");
                        }}
                        options={governorateOptions}
                        placeholder={
                          shippingOptionsLoading
                            ? isArabic
                              ? "جاري تحميل محافظات الوسيط..."
                              : "Loading Alwaseet cities..."
                            : isArabic
                              ? "ابحث أو اختر المحافظة..."
                              : "Search or select governorate..."
                        }
                        searchPlaceholder={isArabic ? "اكتب أول حرفين من المحافظة" : "Type 1-2 letters"}
                        emptyMessage={isArabic ? "لا توجد محافظة بهذا الاسم" : "No governorate found"}
                        error={formErrors.province}
                      />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <SearchableSelect
                        label={isArabic ? "المنطقة أو القضاء" : "Region / district"}
                        required
                        value={region}
                        onChange={setRegion}
                        options={regionOptions}
                        disabled={!city || regionsLoading}
                        allowCustomValue={!alwaseetCities.length}
                        placeholder={
                          regionsLoading
                            ? isArabic
                              ? "جاري تحميل مناطق الوسيط..."
                              : "Loading Alwaseet regions..."
                            : city
                            ? isArabic
                              ? "ابحث عن منطقتك..."
                              : "Search your district..."
                            : isArabic
                              ? "اختر المحافظة أولاً..."
                              : "Select governorate first..."
                        }
                        searchPlaceholder={isArabic ? "اكتب حرفاً أو حرفين من المنطقة" : "Type 1-2 letters"}
                        emptyMessage={
                          isArabic
                            ? alwaseetCities.length
                              ? "لا توجد منطقة بهذا الاسم ضمن بيانات الوسيط"
                              : "اكتب اسم منطقتك إذا لم تظهر في القائمة"
                            : alwaseetCities.length
                              ? "No Alwaseet region found with this name"
                              : "Type your district if it is not listed"
                        }
                        error={formErrors.region}
                      />
                      <Input
                        label={isArabic ? "أقرب نقطة دالة (اختياري)" : "Nearest point (optional)"}
                        placeholder={isArabic ? "قرب معلم معروف" : "Near a known landmark"}
                        value={nearestPoint}
                        onChange={(e) => setNearestPoint(e.target.value)}
                        error={formErrors.nearestPoint}
                      />
                    </div>
                    <SearchableSelect
                      label={isArabic ? "حجم الطرد" : "Package size"}
                      required
                      value={packageSize}
                      onChange={(value) => {
                        setPackageSize(value);
                        setPackageSizeError(undefined);
                      }}
                      options={packageSizeOptions}
                      disabled={shippingOptionsLoading || !packageSizeOptions.length}
                      placeholder={
                        shippingOptionsLoading
                          ? isArabic
                            ? "جاري تحميل أحجام الطرود..."
                            : "Loading package sizes..."
                          : isArabic
                            ? "اختر حجم الطرد..."
                            : "Select package size..."
                      }
                      searchPlaceholder={isArabic ? "ابحث عن حجم الطرد" : "Search package size"}
                      emptyMessage={isArabic ? "لا توجد أحجام طرود من الوسيط" : "No Alwaseet package sizes found"}
                      error={packageSizeError}
                    />
	                  <Input icon={MapPin} label={isArabic ? "العنوان (اختياري)" : "Address (optional)"} placeholder={isArabic ? "الشارع، البناية، الشقة" : "Street, building, apt."} value={address} onChange={(e) => setAddress(e.target.value)} error={formErrors.fullAddress} />
                    <TextArea
                      label={isArabic ? "ملاحظات التوصيل (اختياري)" : "Delivery notes (optional)"}
                      placeholder={isArabic ? "ملاحظات اختيارية للتأكيد أو التوصيل" : "Optional notes for confirmation or delivery"}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={500}
                    />

                    {formError && (
                      <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
	                </div>
	              </Card>


              {/* Payment card */}
              <Card
                icon={paymentMethod === "qi_card" ? CreditCard : Banknote}
                number="03"
                title={t("checkout.payment")}
                hint={isArabic ? "التحويل عبر Qi Card هو الخيار الأساسي، ويمكنك تغييره للدفع عند الاستلام." : "Qi Card transfer is the default option. You can switch to cash on delivery."}
              >
                <div className="grid gap-3">
                  <PaymentOption
                    active={paymentMethod === "qi_card"}
                    icon={CreditCard}
                    title={isArabic ? "تحويل Qi Card / ماستر" : "Qi Card / Master transfer"}
                    description={
                      isArabic
                        ? `حوّل المبلغ إلى رقم الماستر ${QI_CARD_NUMBER} ثم أرسل صورة الحوالة عبر واتساب للموافقة على الطلب.`
                        : `Transfer the total to Master number ${QI_CARD_NUMBER}, then send the receipt image on WhatsApp for approval.`
                    }
                    onSelect={() => setPaymentMethod("qi_card")}
                  >
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(QI_CARD_NUMBER);
                            toast.success(isArabic ? "تم نسخ رقم الماستر" : "Master number copied");
                          } catch {
                            toast.error(isArabic ? "تعذر نسخ الرقم" : "Could not copy number");
                          }
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-background/70 px-4 py-2.5 text-xs font-mono text-foreground hover:border-primary/50 hover:text-primary smooth"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {QI_CARD_NUMBER}
                      </button>
                      <a
                        href={`https://wa.me/${EDIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                          isArabic
                            ? `مرحبا edio، أرسلت حوالة Qi Card لطلب بقيمة ${formatPrice(total, lang, currency)}. سأرسل صورة الحوالة الآن.`
                            : `Hello edio, I sent a Qi Card transfer for an order total of ${formatPrice(total, lang, currency)}. I will send the receipt image now.`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-black hover:brightness-110 smooth"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {isArabic ? "إرسال صورة الحوالة" : "Send receipt image"}
                      </a>
                    </div>
                  </PaymentOption>

                  <PaymentOption
                    active={paymentMethod === "cod"}
                    icon={Banknote}
                    title={isArabic ? "الدفع عند الاستلام" : "Cash on Delivery"}
                    description={
                      isArabic
                        ? "ادفع بالدينار العراقي عند استلام الطلب، وسيتم تأكيد المبلغ قبل التوصيل."
                        : "Pay in Iraqi dinars when your order arrives. We confirm the total before delivery."
                    }
                    onSelect={() => setPaymentMethod("cod")}
                  />
                </div>
              </Card>

              {/* Desktop submit */}
              <div className="hidden lg:block space-y-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full rounded-2xl bg-primary hover:bg-primary-glow disabled:opacity-60 text-primary-foreground py-5 text-sm font-semibold uppercase tracking-widest smooth"
                >
                  <span className="inline-flex items-center justify-center gap-3">
                    {submitting ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        {t("cta.placeOrder")}
                        <span className="opacity-50">·</span>
                        <span className="font-mono">{formatPrice(total, lang, currency)}</span>
                        <ArrowRight className="h-4 w-4 smooth group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
                <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> {isArabic ? "خاص وآمن" : "Private & secure"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" />{" "}
                    {isArabic
                      ? paymentMethod === "qi_card"
                        ? "موافقة بعد صورة الحوالة"
                        : "تأكيد يدوي"
                      : paymentMethod === "qi_card"
                        ? "Receipt approval"
                        : "Manual confirmation"}
                  </span>
                </div>
              </div>
            </form>

            {/* Summary */}
            <aside className="lg:sticky lg:top-28 self-start space-y-4">
              <div className="bg-[#15120f] border border-white/10 overflow-hidden rounded-3xl shadow-[0_18px_80px_hsl(0_0%_0%/0.35)]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-border/30">
                  <div className="inline-flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <p className="label-tech">{t("checkout.summary")}</p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Items */}
                <div className="px-5 md:px-6 py-5 space-y-4 max-h-[300px] overflow-y-auto">
                  {items.map((i) => (
                    <div key={i.id} className="flex gap-3.5 group">
                      <div className="relative shrink-0 pe-2 pt-2">
                        <div className="h-14 w-14 overflow-hidden bg-background">
                          <img
                            src={i.product.image}
                            alt=""
                            className="h-full w-full object-cover smooth group-hover:scale-[1.02]"
                          />
                        </div>
                        <span className="absolute end-0 top-0 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/25 bg-primary px-1.5 font-display text-[11px] font-semibold leading-none tracking-normal text-primary-foreground shadow-[0_6px_18px_hsl(var(--primary)/0.38)] ring-2 ring-[#15120f] tabular-nums">
                          ×{i.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{i.product.name[lang]}</p>
                        <p className="label-tech mt-0.5">{i.product.brand}</p>
                      </div>
                      <p className="font-mono text-sm self-start whitespace-nowrap">
                        {formatPrice(i.product.price * i.quantity, lang, currency)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Free shipping progress */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30 bg-background/40">
                  {remainingForFree > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Truck className="h-3 w-3" />
                          Add {formatPrice(remainingForFree, lang, currency)} for free shipping
                        </span>
                        <span className="font-mono text-muted-foreground">{Math.round(freeProgress)}%</span>
                      </div>
                      <div className="h-1 bg-border/40 overflow-hidden">
                        <div
                          className="h-full w-full origin-start bg-primary transition-transform duration-300 ease-out"
                          style={{ transform: `scaleX(${freeProgress / 100})` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-primary">
                      <Sparkles className="h-3 w-3" />
                      <span className="font-mono uppercase tracking-widest">You unlocked free shipping</span>
                    </div>
                  )}
                </div>

                {/* Coupon */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30">
                  {coupon ? (
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-primary/10 border border-primary/30">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-mono uppercase tracking-widest text-primary truncate">
                            {coupon.code}
                          </p>
                          <p className="text-[10.5px] text-muted-foreground truncate">{coupon.label}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remove coupon"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : showCouponInput ? (
                    <form onSubmit={handleApplyCoupon} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            if (couponFeedback) setCouponFeedback(null);
                          }}
                          maxLength={32}
                          placeholder="ENTER CODE"
                          autoFocus
                          className="flex-1 bg-background px-3 py-2.5 text-xs font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground/60 border border-border/40 focus:border-primary/60 outline-none smooth"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-foreground text-background text-[11px] font-semibold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground smooth"
                        >
                          Apply
                        </button>
                      </div>
                      {couponFeedback && (
                        <div
                          className={`flex items-center gap-1.5 text-[11px] ${couponFeedback.type === "success" ? "text-primary" : "text-destructive"}`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>{couponFeedback.message}</span>
                        </div>
                      )}
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCouponInput(true)}
                      className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary smooth"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Have a promo code?</span>
                    </button>
                  )}
                </div>

                {/* Totals */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30 space-y-2.5 text-sm">
                  <Row label={t("common.subtotal")} value={formatPrice(subtotal, lang, currency)} />
                  {coupon && discount > 0 && (
                    <Row label={`Discount · ${coupon.code}`} value={`−${formatPrice(discount, lang, currency)}`} accent />
                  )}
                  <Row
                    label={t("common.shipping")}
                    value={shipping === 0 ? t("common.free") : formatPrice(shipping, lang, currency)}
                    accent={shipping === 0}
                  />
                </div>

                {/* Total bar */}
                <div className="px-5 md:px-6 py-5 bg-[#24211d] border-t border-primary/30 text-foreground flex items-end justify-between">
                  <div>
                    <p className="label-tech mb-1 text-muted-foreground">{t("common.total")}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {currency === "IQD"
                        ? isArabic
                          ? paymentMethod === "qi_card"
                            ? "تحويل Qi Card (IQD)"
                            : "الدفع عند الاستلام (IQD)"
                          : paymentMethod === "qi_card"
                            ? "Qi Card transfer (IQD)"
                            : "Cash on delivery (IQD)"
                        : isArabic
                          ? paymentMethod === "qi_card"
                            ? "تحويل Qi Card · عرض بالدولار"
                            : "الدفع عند الاستلام · عرض بالدولار"
                          : paymentMethod === "qi_card"
                            ? "Qi Card transfer · USD display"
                            : "Cash on delivery · USD display"}
                    </p>
                  </div>
                  <p className="font-mono text-2xl md:text-3xl text-primary leading-none">
                    {formatPrice(total, lang, currency)}
                  </p>
                </div>
              </div>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <TrustBadge icon={Truck} label="Fast delivery" />
                <TrustBadge icon={ShieldCheck} label="Genuine gear" />
                <TrustBadge icon={Phone} label="Iraq support" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile sticky submit bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border/40 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="label-tech text-muted-foreground">{t("common.total")}</p>
            <p className="font-mono text-lg text-primary leading-tight truncate">{formatPrice(total, lang, currency)}</p>
          </div>
          <button
            type="submit"
            form=""
            onClick={(e) => {
              const form = (e.currentTarget.closest("section") as HTMLElement)?.parentElement?.querySelector("form");
              form?.requestSubmit();
            }}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary-glow disabled:opacity-60 text-primary-foreground py-3.5 text-xs font-semibold uppercase tracking-widest smooth"
          >
            {submitting ? "Processing…" : t("cta.placeOrder")}
            {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </Layout>
  );
};

function Card({
  icon: Icon,
  number,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  number: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-[#15120f] border border-white/10 p-5 md:p-7 shadow-[0_12px_60px_hsl(0_0%_0%/0.22)]">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-primary tracking-widest">{number}</span>
            <h3 className="font-display text-xl md:text-2xl font-bold tracking-normal leading-none">{title}</h3>
          </div>
          {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PaymentOption({
  active,
  icon: Icon,
  title,
  description,
  onSelect,
  children,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-5 md:p-6 smooth ${
        active
          ? "border-primary/60 bg-primary/[0.08] ring-1 ring-primary/20"
          : "border-white/10 bg-[#1d1915] hover:border-primary/35"
      }`}
    >
      {active && (
        <span className="absolute top-0 end-0 rounded-bl-xl rounded-tr-2xl bg-primary px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-primary-foreground">
          Selected
        </span>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex w-full items-start gap-4 text-start"
      >
        <span
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${
            active ? "bg-primary/15 text-primary ring-primary/25" : "bg-background/70 text-muted-foreground ring-white/10"
          }`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">{title}</span>
          </span>
          <span className="mt-2 block text-xs leading-relaxed text-muted-foreground md:text-[13px]">
            {description}
          </span>
        </span>
      </button>
      {children}
    </div>
  );
}

function Input({
  label,
  icon: Icon,
  error,
  ...props
}: { label: string; icon?: React.ComponentType<{ className?: string }>; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isReadOnly = props.readOnly;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <label
      htmlFor={inputId}
      onClick={() => inputRef.current?.focus()}
      className={`group block min-h-[5.75rem] cursor-text rounded-2xl bg-[#27231e] border ${error ? "border-destructive/60" : "border-white/10"} hover:border-primary/40 focus-within:border-primary/80 focus-within:bg-[#2f2a24] focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5 ${isReadOnly ? "opacity-70 hover:border-border/60 focus-within:ring-0" : ""}`}
    >
      <span className="label-tech mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 opacity-60" />}
        {label}
        {isReadOnly && (
          <span className="text-[9px] font-mono text-muted-foreground/60 normal-case tracking-normal">(locked)</span>
        )}
      </span>
      <input
        id={inputId}
        ref={inputRef}
        {...props}
        aria-invalid={Boolean(error)}
        className="w-full bg-transparent border-0 outline-none text-base text-foreground placeholder:text-muted-foreground/55 read-only:cursor-not-allowed"
      />
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
  required,
  allowCustomValue = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  required?: boolean;
  allowCustomValue?: boolean;
  error?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = options.find((option) => option.value === value)?.label ?? (allowCustomValue ? value : "");
  const normalizedQuery = normalizeOptionSearch(query);
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      [option.label, option.value, ...(option.keywords ?? [])].some((candidate) =>
        normalizeOptionSearch(candidate).includes(normalizedQuery),
      ),
    );
  }, [normalizedQuery, options]);

  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [open, selectedLabel]);

  const selectOption = (option: SearchableOption) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <label
      htmlFor={inputId}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onClick={() => {
        if (!disabled) {
          setOpen(true);
          inputRef.current?.focus();
        }
      }}
      className={`block min-h-[5.75rem] rounded-2xl bg-[#27231e] border ${error ? "border-destructive/60" : "border-white/10"} ${disabled ? "opacity-65" : "cursor-text hover:border-primary/40 focus-within:border-primary/80 focus-within:bg-[#2f2a24] focus-within:ring-2 focus-within:ring-primary/20"} smooth p-3.5 relative`}
    >
      <span className="label-tech block mb-1.5">
        {label}
        {required && <span className="ms-1 text-primary">*</span>}
      </span>
      <input
        id={inputId}
        ref={inputRef}
        value={open ? query : selectedLabel}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          setOpen(true);
          if (allowCustomValue) {
            onChange(nextValue);
          } else if (value && nextValue !== selectedLabel) {
            onChange("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
          if (event.key === "Enter" && open && filteredOptions[0]) {
            event.preventDefault();
            selectOption(filteredOptions[0]);
          }
        }}
        disabled={disabled}
        required={required}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-options`}
        aria-invalid={Boolean(error)}
        aria-autocomplete="list"
        placeholder={open ? searchPlaceholder : placeholder}
        className="relative z-10 w-full min-h-8 bg-transparent border-0 outline-none text-base text-foreground placeholder:text-muted-foreground/55 disabled:cursor-not-allowed"
      />
      <span className="absolute end-4 bottom-4 pointer-events-none text-muted-foreground text-xs">▾</span>
      {open && !disabled && (
        <div
          id={`${inputId}-options`}
          role="listbox"
          className="absolute inset-x-3 top-[calc(100%-0.25rem)] z-40 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#15120f] p-1.5 shadow-2xl ring-1 ring-black/40"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  selectOption(option);
                }}
                className={`block w-full rounded-xl px-3 py-2.5 text-start text-sm smooth ${
                  option.value === value
                    ? "bg-primary/18 text-primary ring-1 ring-primary/25"
                    : "text-foreground hover:bg-white/8 hover:text-primary"
                }`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</div>
          )}
        </div>
      )}
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function CountryCodePicker({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (countryCode: string) => void;
  lang: "en" | "ar";
}) {
  const selectedCountry = COUNTRIES.find((country) => country.code === value) || COUNTRIES[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredCountries = useMemo(() => {
    const normalizedQuery = normalizeOptionSearch(query);
    if (!normalizedQuery) return COUNTRIES;
    return COUNTRIES.filter((country) =>
      [country.name, country.code, country.dial].some((candidate) =>
        normalizeOptionSearch(candidate).includes(normalizedQuery),
      ),
    );
  }, [query]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <span
      className="relative inline-flex shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1b1814] border border-white/10 px-2.5 py-1.5 text-sm text-foreground hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 smooth"
      >
        <span className="text-base leading-none" aria-hidden>
          {countryFlagEmoji(selectedCountry.code)}
        </span>
        <span className="max-w-[5.5rem] truncate">{selectedCountry.name}</span>
        <span className="font-mono">{selectedCountry.dial}</span>
        <span className="text-[10px] text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute start-0 top-full z-50 mt-2 w-72 max-w-[82vw] rounded-2xl border border-white/10 bg-[#15120f] p-2 shadow-2xl ring-1 ring-black/40">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lang === "ar" ? "ابحث عن الدولة أو الرقم..." : "Search country or code..."}
            className="mb-2 w-full rounded-xl border border-white/10 bg-[#27231e] px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-primary/70"
          />
          <div role="listbox" className="max-h-60 overflow-y-auto">
            {filteredCountries.slice(0, 80).map((country) => (
              <button
                key={country.code}
                type="button"
                role="option"
                aria-selected={country.code === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(country.code);
                  setQuery("");
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm smooth ${
                  country.code === value
                    ? "bg-primary/18 text-primary ring-1 ring-primary/25"
                    : "text-foreground hover:bg-white/8 hover:text-primary"
                }`}
              >
                <span aria-hidden>{countryFlagEmoji(country.code)}</span>
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
                <span className="font-mono text-xs">{country.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

function PhoneInput({
  label,
  lang = "en",
  error,
  countryCode,
  onCountryChange,
  ...props
}: {
  label: string;
  lang?: "en" | "ar";
  error?: string;
  countryCode: string;
  onCountryChange: (countryCode: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const selectedCountry = COUNTRIES.find((country) => country.code === countryCode) || COUNTRIES[0];
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <label
      htmlFor={inputId}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button")) return;
        inputRef.current?.focus();
      }}
      className={`block min-h-[5.75rem] cursor-text rounded-2xl bg-[#27231e] border ${error ? "border-destructive/60" : "border-white/10"} hover:border-primary/40 focus-within:border-primary/80 focus-within:bg-[#2f2a24] focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5`}
    >
      <span className="label-tech mb-1.5 flex items-center gap-1.5">
        <Phone className="h-3 w-3 opacity-60" />
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        <CountryCodePicker value={selectedCountry.code} onChange={onCountryChange} lang={lang} />
        <input
          id={inputId}
          ref={inputRef}
          {...props}
          type="tel"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={18}
          aria-invalid={Boolean(error)}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base text-foreground placeholder:text-muted-foreground/55"
        />
      </div>
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function TextArea({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <label
      htmlFor={textareaId}
      onClick={() => textareaRef.current?.focus()}
      className={`block min-h-[9rem] cursor-text rounded-2xl bg-[#27231e] border ${error ? "border-destructive/60" : "border-white/10"} hover:border-primary/40 focus-within:border-primary/80 focus-within:bg-[#2f2a24] focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5`}
    >
      <span className="label-tech block mb-1.5">{label}</span>
      <textarea
        id={textareaId}
        ref={textareaRef}
        {...props}
        rows={3}
        aria-invalid={Boolean(error)}
        className="min-h-[6.5rem] w-full resize-none bg-transparent border-0 outline-none text-base text-foreground placeholder:text-muted-foreground/55"
      />
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={accent ? "text-primary" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="bg-surface-low/60 border border-border/30 py-3 px-2 flex flex-col items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export default Checkout;
