import { describe, expect, it } from "vitest";
import { matchesProductSearch, scoreProductSearch } from "./search";

const dacProduct = {
  name: { en: "FiiO K11", ar: "FiiO K11" },
  brand: "FiiO",
  category: "dac",
  subCategories: ["desktop"],
  tagline: { en: "Desktop DAC and amplifier", ar: "داك وامب مكتبي" },
  features: ["USB DAC with headphone amplifier"],
  specs: [{ label: "Connection", value: "USB-C" }],
};

describe("search helpers", () => {
  it("matches Arabic synonyms against English catalog terms", () => {
    expect(matchesProductSearch(dacProduct, "داك")).toBe(true);
    expect(matchesProductSearch(dacProduct, "امب")).toBe(true);
    expect(scoreProductSearch(dacProduct, "كرت صوت")).toBe(0);
  });
});
