type SupportedLanguage = "en" | "ar";

const arabicIndicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function localeWithEnglishDigits(lang: SupportedLanguage = "en") {
  return lang === "ar" ? "ar-IQ-u-nu-latn" : "en-US-u-nu-latn";
}

export function normalizeEnglishDigits(value: string) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(arabicIndicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
    .replace(/\u066B/g, ".")
    .replace(/\u066C/g, ",");
}

export function sanitizeNumericInput(
  value: string,
  options: { allowDecimal?: boolean; allowNegative?: boolean } = {},
) {
  const { allowDecimal = false, allowNegative = false } = options;
  let sanitized = normalizeEnglishDigits(value).replace(/,/g, "");
  sanitized = sanitized.replace(allowDecimal ? /[^0-9.-]/g : /[^0-9-]/g, "");

  if (allowNegative) {
    sanitized = sanitized.replace(/(?!^)-/g, "");
  } else {
    sanitized = sanitized.replace(/-/g, "");
  }

  if (allowDecimal) {
    const dotIndex = sanitized.indexOf(".");
    if (dotIndex >= 0) {
      sanitized = sanitized.slice(0, dotIndex + 1) + sanitized.slice(dotIndex + 1).replace(/\./g, "");
    }
  } else {
    sanitized = sanitized.replace(/\./g, "");
  }

  return sanitized;
}

export function formatNumber(
  value: number,
  lang: SupportedLanguage = "en",
  options: Intl.NumberFormatOptions = {},
) {
  const key = JSON.stringify([lang, options]);
  if (!numberFormatters.has(key)) {
    numberFormatters.set(
      key,
      new Intl.NumberFormat(localeWithEnglishDigits(lang), {
        numberingSystem: "latn",
        ...options,
      }),
    );
  }

  return numberFormatters.get(key)!.format(value);
}

function getDateFormatter(
  lang: SupportedLanguage,
  options: Intl.DateTimeFormatOptions,
) {
  const key = JSON.stringify([lang, options]);
  if (!dateFormatters.has(key)) {
    dateFormatters.set(
      key,
      new Intl.DateTimeFormat(localeWithEnglishDigits(lang), {
        numberingSystem: "latn",
        ...options,
      }),
    );
  }

  return dateFormatters.get(key)!;
}

export function formatDate(
  value: string | number | Date,
  lang: SupportedLanguage = "en",
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return getDateFormatter(lang, options).format(date);
}

export function formatDateTime(
  value: string | number | Date,
  lang: SupportedLanguage = "en",
  options: Intl.DateTimeFormatOptions = {},
) {
  return formatDate(value, lang, options);
}
