import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { buildPageTitle, type PageTitleType } from "@/lib/pageTitle";

type SeoProps = {
  title: string;
  description: string;
  parentTitle?: string;
  pageType?: PageTitleType;
  isHome?: boolean;
  isAdmin?: boolean;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "product";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const SITE_NAME = "edio";
const DEFAULT_ORIGIN = "https://edio-iq.com";
const DEFAULT_IMAGE = "/og/edio-og.png";
const DEFAULT_IMAGE_ALT = "edio premium audio store";

function getOrigin() {
  if (typeof window === "undefined") return DEFAULT_ORIGIN;
  if (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") {
    return DEFAULT_ORIGIN;
  }
  return window.location.origin;
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

function getImageType(imageUrl: string) {
  const path = imageUrl.split("?")[0].toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export function Seo({
  title,
  parentTitle,
  pageType,
  isHome,
  isAdmin,
  canonicalPath,
  description,
  image = DEFAULT_IMAGE,
  imageAlt = DEFAULT_IMAGE_ALT,
  type = "website",
  jsonLd,
}: SeoProps) {
  const location = useLocation();

  useEffect(() => {
    const origin = getOrigin();
    const canonical = `${origin}${canonicalPath || location.pathname}`;
    const fullTitle = buildPageTitle({ type: pageType, title, parentTitle, isHome, isAdmin });
    const imageUrl = image.startsWith("http") ? image : `${origin}${image}`;
    const imageType = getImageType(imageUrl);

    document.title = fullTitle;
    upsertLink("canonical", canonical);
    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: "index,follow,max-image-preview:large" });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
    upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    upsertMeta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: imageUrl });
    upsertMeta('meta[property="og:image:type"]', { property: "og:image:type", content: imageType });
    upsertMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
    upsertMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });
    upsertMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: imageAlt });
    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
    upsertMeta('meta[name="twitter:site"]', { name: "twitter:site", content: "@edio_iq" });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    upsertMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: imageAlt });

    document
      .querySelectorAll('script[data-edio-seo="jsonld"], script[data-edio-static-seo="jsonld"]')
      .forEach((node) => node.remove());
    if (jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.edioSeo = "jsonld";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
  }, [canonicalPath, description, image, imageAlt, isAdmin, isHome, jsonLd, location.pathname, pageType, parentTitle, title, type]);

  return null;
}
