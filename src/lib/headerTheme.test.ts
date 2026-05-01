import { describe, expect, it } from "vitest";
import { resolveHeaderSurfaceFromRects, resolveHeaderThemeFromRects } from "./headerTheme";

describe("adaptive header theme", () => {
  it("uses the section that covers the header sampling band", () => {
    expect(resolveHeaderSurfaceFromRects([{ surface: "light", top: 0, bottom: 160 }], 90)).toBe("light");
    expect(resolveHeaderSurfaceFromRects([{ surface: "dark", top: 0, bottom: 160 }], 90)).toBe("dark");
  });

  it("falls back to the nearest valid section when none covers the header", () => {
    expect(
      resolveHeaderSurfaceFromRects(
        [
          { surface: "dark", top: -420, bottom: -100 },
          { surface: "light", top: 126, bottom: 500 },
        ],
        90,
      ),
    ).toBe("light");
  });

  it("ignores unknown theme values and falls back safely", () => {
    expect(resolveHeaderSurfaceFromRects([{ surface: "blue", top: 0, bottom: 500 }], 90)).toBe("dark");
  });

  it("supports mixed media surfaces explicitly", () => {
    expect(resolveHeaderSurfaceFromRects([{ surface: "mixed", top: 0, bottom: 500 }], 90)).toBe("mixed");
    expect(resolveHeaderThemeFromRects([{ surface: "mixed", top: 0, bottom: 500 }], 90)).toBe("dark");
  });

  it("switches surfaces as the header sample moves through dark and light hero sections", () => {
    const sections = [
      { surface: "dark", top: 0, bottom: 320 },
      { surface: "light", top: 320, bottom: 760 },
      { surface: "mixed", top: 760, bottom: 1180 },
    ];

    expect(resolveHeaderSurfaceFromRects(sections, 90)).toBe("dark");
    expect(resolveHeaderSurfaceFromRects(sections, 420)).toBe("light");
    expect(resolveHeaderSurfaceFromRects(sections, 860)).toBe("mixed");
  });

  it("keeps legacy data-header-theme sections working during migration", () => {
    expect(resolveHeaderSurfaceFromRects([{ theme: "light", top: 0, bottom: 160 }], 90)).toBe("light");
  });

  it("prefers a more specific nested surface when parent and child both cover the header", () => {
    expect(
      resolveHeaderSurfaceFromRects(
        [
          { surface: "dark", top: -600, bottom: 600 },
          { surface: "light", top: 40, bottom: 260 },
        ],
        90,
      ),
    ).toBe("light");
  });
});
