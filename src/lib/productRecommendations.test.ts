import { describe, expect, it } from "vitest";
import { getProductRecommendationSections, type RecommendationProduct } from "./productRecommendations";

const iem2Pin = {
  id: "iem-2pin",
  brand: "Moondrop",
  category: "iems",
  subCategories: ["dynamic-driver"],
  specs: [
    { label: "Connector", value: "0.78mm 2-pin" },
    { label: "Driver", value: "Dynamic driver" },
  ],
  inStock: true,
  price: 99000,
};

const xlrMic = {
  id: "xlr-mic",
  brand: "Shure",
  category: "mic",
  subCategories: ["dynamic"],
  specs: [{ label: "Connector", value: "XLR" }],
  inStock: true,
  price: 420000,
};

const usbMic = {
  id: "usb-mic",
  brand: "Rode",
  category: "mic",
  subCategories: ["condenser"],
  specs: [{ label: "Connector", value: "USB-C" }],
  inStock: true,
  price: 180000,
};

const openBack = {
  id: "open-planar",
  brand: "HiFiMAN",
  category: "headphones",
  subCategories: ["open-back", "planar-driver"],
  specs: [
    { label: "Impedance", value: "50 Ohms" },
    { label: "Sensitivity", value: "83.5 dB/mW" },
  ],
  inStock: true,
  price: 499000,
};

function sectionIds(product: RecommendationProduct, products: RecommendationProduct[], type: string) {
  return getProductRecommendationSections(product, products, "en")
    .find((section) => section.type === type)
    ?.items.map((item) => item.product.id) || [];
}

describe("product recommendation engine", () => {
  it("recommends safe IEM accessories and blocks incompatible cable connectors", () => {
    const products = [
      iem2Pin,
      { id: "tips", brand: "SpinFit", category: "accessories", subCategories: ["eartips"], inStock: true, price: 19000 },
      { id: "mmcx", brand: "Tripowin", category: "accessories", subCategories: ["audio-cables"], specs: [{ label: "Connector", value: "MMCX" }], inStock: true, price: 34000 },
      { id: "twopin", brand: "Tripowin", category: "accessories", subCategories: ["audio-cables"], specs: [{ label: "Connector", value: "2-pin 0.78mm" }], inStock: true, price: 34000 },
    ];

    const ids = sectionIds(iem2Pin, products, "recommended_accessories");
    expect(ids).toContain("tips");
    expect(ids).toContain("twopin");
    expect(ids).not.toContain("mmcx");
  });

  it("recommends interface for XLR microphones but not USB microphones", () => {
    const interfaceProduct = { id: "iface", brand: "Focusrite", category: "audio-interface", subCategories: ["desktop"], inStock: true, price: 250000 };
    expect(sectionIds(xlrMic, [xlrMic, usbMic, interfaceProduct], "compatible_with")).toContain("iface");
    expect(sectionIds(usbMic, [xlrMic, usbMic, interfaceProduct], "compatible_with")).not.toContain("iface");
  });

  it("recommends amplification for hard-to-drive open-back headphones", () => {
    const desktopDac = { id: "dac", brand: "FiiO", category: "dac", subCategories: ["desktop"], inStock: true, price: 249000 };
    const mic = { id: "mic", brand: "Audio-Technica", category: "mic", subCategories: ["condenser"], inStock: true, price: 190000 };
    const ids = sectionIds(openBack, [openBack, desktopDac, mic], "compatible_with");
    expect(ids).toContain("dac");
    expect(ids).not.toContain("mic");
  });

  it("hides hidden, review, and low-confidence recommendations", () => {
    const products = [
      iem2Pin,
      { id: "hidden", brand: "Moondrop", category: "iems", subCategories: ["dynamic-driver"], status: "hidden", inStock: true, price: 90000 },
      { id: "review", brand: "Moondrop", category: "iems", subCategories: ["dynamic-driver"], needsReview: true, inStock: true, price: 90000 },
      { id: "random", brand: "AKG", category: "headphones", subCategories: ["closed-back"], inStock: true, price: 140000 },
    ];
    const allIds = getProductRecommendationSections(iem2Pin, products, "en").flatMap((section) =>
      section.items.map((item) => item.product.id),
    );
    expect(allIds).not.toContain("hidden");
    expect(allIds).not.toContain("review");
    expect(allIds).not.toContain("random");
  });

  it("puts manual relationships first and honors blocked relationships", () => {
    const source = {
      ...iem2Pin,
      relationships: [
        { targetProductId: "manual", relationshipType: "similar", reason: "Approved by admin", priority: 20, active: true },
        { targetProductId: "blocked", relationshipType: "blocked", active: true },
      ],
    };
    const products = [
      source,
      { id: "manual", brand: "Moondrop", category: "iems", subCategories: ["dynamic-driver"], inStock: true, price: 99000 },
      { id: "blocked", brand: "Moondrop", category: "iems", subCategories: ["dynamic-driver"], inStock: true, price: 99000 },
    ];
    const similar = getProductRecommendationSections(source, products, "en").find((section) => section.type === "similar_products");
    expect(similar?.items[0].product.id).toBe("manual");
    expect(similar?.items.map((item) => item.product.id)).not.toContain("blocked");
    expect(similar?.items[0].reason).toBe("Approved by admin");
  });
});
