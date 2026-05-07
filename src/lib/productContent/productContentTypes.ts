export type ProductInfoTab = "description" | "sound" | "specs";

export type ProductMediaLicenseStatus =
  | "official_manufacturer"
  | "owned"
  | "licensed"
  | "authorized_distributor"
  | "unknown"
  | "do_not_use";

export type ProductSourceType =
  | "manufacturer"
  | "official_manual"
  | "authorized_distributor"
  | "expert_review"
  | "forum_user_review"
  | "internal";

export type ProductSourceConfidence = "high" | "medium" | "low";

export type ProductMediaPlacement = "gallery" | "description" | "sound" | "specs";

export type ProductSourceRef = {
  id: string;
  title: string;
  url: string;
  sourceType: ProductSourceType;
  confidence: ProductSourceConfidence;
  usedFields?: Array<"specs" | "sound" | "description" | "images">;
  notes?: string;
};

export type ProductPageMedia = {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  sourceUrl?: string;
  licenseStatus: ProductMediaLicenseStatus;
  placement: ProductMediaPlacement;
  order: number;
  isPrimary?: boolean;
};

export type ProductVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  sourceUrl?: string;
};

export type ProductContentBlock = {
  id: string;
  type:
    | "hero_editorial"
    | "brand_story"
    | "feature"
    | "image_text"
    | "full_width_image"
    | "video_embed"
    | "press_quote"
    | "faq";
  title: string;
  subtitle?: string;
  body: string;
  media?: ProductPageMedia;
  video?: ProductVideo;
  layout?: "image-left" | "image-right" | "full-width" | "two-column";
  order: number;
  visible: boolean;
  sourceRefIds?: string[];
};

export type ProductPageSpec = {
  name: string;
  value: string;
  unit?: string;
  sourceRefId?: string;
};

export type ProductPageSpecGroup = {
  id: string;
  title: "Audio" | "Connectivity" | "Design & Build" | "Power/Battery" | "In The Box" | "Warranty" | string;
  specs: ProductPageSpec[];
  order: number;
};

export type ProductPageSound = {
  signature?: string;
  bass?: string;
  mids?: string;
  treble?: string;
  soundstage?: string;
  imaging?: string;
  detail?: string;
  comfort?: string;
  pairing?: string;
  genreMatch?: string[];
  dacAmpRequirement?: string;
  graphImage?: ProductPageMedia;
  sourceRefs?: ProductSourceRef[];
  sourceConfidence?: ProductSourceConfidence;
};

export type ProductPageSeo = {
  title?: string;
  metaDescription?: string;
  keywords?: string[];
  canonicalPath?: string;
  ogImage?: string;
};

export type ProductPageContent = {
  description?: {
    blocks: ProductContentBlock[];
  };
  sound?: ProductPageSound;
  specs?: {
    groups: ProductPageSpecGroup[];
  };
  media?: ProductPageMedia[];
  videos?: ProductVideo[];
  sources?: ProductSourceRef[];
  seo?: ProductPageSeo;
  seoWarnings?: string[];
  contentStatus: "draft" | "needs_research" | "reviewed" | "published";
  updatedAt?: string;
};

export type ProductEditorialBlock = {
  id: string;
  title: string;
  body: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  layout?: "image-left" | "image-right" | "full-width-image" | "text-only";
};

export type ProductSoundProfile = {
  summary?: string;
  signature?: string;
  strengths?: string[];
  listeningNotes?: ProductEditorialBlock[];
  frequencyGraphImage?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  soundTags?: string[];
};

export type ProductSpecGroup = {
  title: string;
  specs: Array<{
    name: string;
    value: string;
    unit?: string;
  }>;
};

export type ProductPressQuote = {
  source: string;
  quote: string;
  url?: string;
  logoAlt?: string;
};

export type ProductBrandStory = {
  brand: string;
  title: string;
  body: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  ctaLabel?: string;
  ctaHref?: string;
};

export type ProductDetailContent = {
  descriptionBlocks?: ProductEditorialBlock[];
  sound?: ProductSoundProfile;
  specGroups?: ProductSpecGroup[];
  brandStory?: ProductBrandStory;
  pressQuotes?: ProductPressQuote[];
  video?: {
    youtubeId?: string;
    title: string;
    thumbnail?: string;
  };
};
