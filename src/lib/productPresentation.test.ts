import { describe, expect, it } from "vitest";
import {
  getCardMeta,
  getCompatibleAccessories,
  getOrderedSpecs,
  getPairingSuggestions,
  getProductHighlights,
  getSimilarProducts,
} from "./productPresentation";

const headphone = {
  id: "h1",
  brand: "HiFiMAN",
  category: "headphones",
  subCategories: ["open-back", "planar-driver"],
  specs: [
    { label: "Frequency Response", value: "8 Hz - 65 kHz" },
    { label: "Impedance", value: "50 Ohms" },
    { label: "Driver Type", value: "Planar Magnetic" },
  ],
  features: ["Requires a capable desktop amplifier.", "User manual and warranty card."],
  inStock: true,
  price: 500,
};

describe("product presentation helpers", () => {
  it("builds concise card metadata from product type facts", () => {
    expect(getCardMeta(headphone, "en")).toContain("Open-back");
    expect(getCardMeta(headphone, "en")).toContain("Planar");
  });

  it("orders specs by category and brand emphasis", () => {
    const labels = getOrderedSpecs(headphone, "en").map((spec) => spec.label);
    expect(labels[0]).toBe("Driver Type");
    expect(labels).toContain("Impedance");
  });

  it("keeps highlights short and excludes box contents", () => {
    const highlights = getProductHighlights(headphone, "en");
    expect(highlights.join(" ")).toContain("Open-back");
    expect(highlights.join(" ")).not.toContain("warranty card");
  });

  it("selects compatible accessories and similar products without creating categories", () => {
    const products = [
      headphone,
      { id: "c1", brand: "Tripowin", category: "accessories", subCategories: ["audio-cables"], inStock: true, price: 20 },
      { id: "i1", brand: "HiFiMAN", category: "iems", subCategories: ["planar-driver"], inStock: true, price: 100 },
      { id: "h2", brand: "AKG", category: "headphones", subCategories: ["closed-back", "dynamic-driver"], inStock: true, price: 200 },
    ];

    expect(getCompatibleAccessories(headphone, products).map((item) => item.id)).toEqual(["c1"]);
    expect(getSimilarProducts(headphone, products).map((item) => item.id)).toContain("h2");
  });

  it("adds pairing reasons without inventing products", () => {
    const products = [
      headphone,
      { id: "dac1", brand: "FiiO", category: "dac", subCategories: ["desktop"], inStock: true, price: 220 },
      { id: "c1", brand: "Tripowin", category: "accessories", subCategories: ["audio-cables"], inStock: true, price: 20 },
    ];

    const pairings = getPairingSuggestions(headphone, products, "en");
    expect(pairings.map((item) => item.product.id)).toContain("dac1");
    expect(pairings.every((item) => item.reason.length > 0)).toBe(true);
  });
});
