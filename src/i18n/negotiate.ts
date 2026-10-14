import { defaultLocale, isLocale, type Locale } from "./config";

// Picks the best supported locale from an Accept-Language header,
// e.g. "de-AT,de;q=0.9,en;q=0.8" -> "de". Region subtags are ignored.
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        q: Number.isNaN(q) ? 0 : q,
        index,
      };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const entry of ranked) {
    if (isLocale(entry.language)) return entry.language;
  }
  return defaultLocale;
}
