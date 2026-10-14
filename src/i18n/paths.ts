import { isLocale, type Locale } from "./config";

// Returns the locale prefix of a pathname, e.g. "/de/assessments" -> "de".
export function getPathLocale(pathname: string): Locale | undefined {
  const first = pathname.split("/")[1];
  return first && isLocale(first) ? first : undefined;
}

// Swaps or adds the locale prefix, e.g. ("/de/assessments", "en") -> "/en/assessments".
export function withLocale(pathname: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLocale(segments[0])) segments.shift();
  return `/${[locale, ...segments].join("/")}`;
}
