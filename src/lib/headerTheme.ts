export type HeaderSurface = "dark" | "light" | "mixed";
export type HeaderTheme = Extract<HeaderSurface, "dark" | "light">;

export type HeaderSurfaceRect = {
  surface?: string | null;
  theme?: string | null;
  top: number;
  bottom: number;
};

export type HeaderThemeRect = HeaderSurfaceRect;

export function isHeaderSurface(value: string | null | undefined): value is HeaderSurface {
  return value === "dark" || value === "light" || value === "mixed";
}

export function isHeaderTheme(value: string | null | undefined): value is HeaderTheme {
  return value === "dark" || value === "light";
}

export function normalizeHeaderSurface(
  value: string | null | undefined,
  fallback: HeaderSurface = "dark",
): HeaderSurface {
  return isHeaderSurface(value) ? value : fallback;
}

export function resolveHeaderSurfaceFromRects(
  sections: HeaderSurfaceRect[],
  sampleY: number,
  fallback: HeaderSurface = "dark",
): HeaderSurface {
  let bestSurface: HeaderSurface | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestCoversHeader = false;
  let bestCoverTopDistance = Number.POSITIVE_INFINITY;

  for (const section of sections) {
    const surface = section.surface ?? section.theme;
    if (!isHeaderSurface(surface)) continue;

    const coversHeader = section.top <= sampleY && section.bottom >= sampleY;
    if (coversHeader) {
      const coverTopDistance = Math.abs(section.top - sampleY);
      if (!bestCoversHeader || coverTopDistance < bestCoverTopDistance) {
        bestSurface = surface;
        bestDistance = 0;
        bestCoversHeader = true;
        bestCoverTopDistance = coverTopDistance;
      }
      continue;
    }

    if (bestCoversHeader) continue;

    const distance = Math.min(Math.abs(section.top - sampleY), Math.abs(section.bottom - sampleY));

    if (distance < bestDistance) {
      bestSurface = surface;
      bestDistance = distance;
    }
  }

  return bestSurface || fallback;
}

export function resolveHeaderThemeFromRects(
  sections: HeaderThemeRect[],
  sampleY: number,
  fallback: HeaderTheme = "dark",
): HeaderTheme {
  const surface = resolveHeaderSurfaceFromRects(sections, sampleY, fallback);
  return surface === "light" ? "light" : "dark";
}
