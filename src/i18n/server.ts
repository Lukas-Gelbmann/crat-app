import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";

// Server Components only: reads the locale from the `[lang]` root segment.
export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!isLocale(locale)) notFound();
  return locale;
}

export async function getCurrentDictionary(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}
