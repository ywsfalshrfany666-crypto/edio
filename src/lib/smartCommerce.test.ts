import { describe, expect, it } from "vitest";
import { getSmartBuyingRecommendations } from "./smartCommerce";

const products = [
  {
    id: "iem1",
    slug: "iem1",
    name: { en: "Daily IEM", ar: "Daily IEM" },
    brand: "Moondrop",
    category: "iems",
    subCategories: ["portable", "wired"],
    tagline: { en: "Balanced portable in-ear monitor", ar: "سماعة IEM متوازنة" },
    price: 99000,
    inStock: true,
    features: ["Balanced sound for phone listening"],
    specs: [{ label: "Connection", value: "3.5mm" }],
  },
  {
    id: "mic1",
    slug: "mic1",
    name: { en: "Studio Mic", ar: "Studio Mic" },
    brand: "Shure",
    category: "mic",
    subCategories: ["dynamic"],
    tagline: { en: "Podcast microphone", ar: "مايك بودكاست" },
    price: 420000,
    inStock: true,
    features: ["Voice and podcast recording"],
    specs: [{ label: "Connector", value: "XLR" }],
  },
];

describe("smart buying recommendations", () => {
  it("returns focused existing products only", () => {
    const recommendations = getSmartBuyingRecommendations(
      products,
      { use: "daily", budget: "budget", sound: "balanced", device: "phone", wire: "wired" },
      "en",
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(3);
    expect(recommendations[0].product.id).toBe("iem1");
  });
});
