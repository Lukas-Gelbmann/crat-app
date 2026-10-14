"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/i18n/config";
import { withLocale } from "@/i18n/paths";

type Props = {
  locale: Locale;
  label: string;
  languageNames: Record<Locale, string>;
};

export function LanguageSwitcher({ locale, label, languageNames }: Props) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex gap-3 text-sm">
      {locales.map((target) => (
        <Link
          key={target}
          href={withLocale(pathname, target)}
          hrefLang={target}
          lang={target}
          aria-current={target === locale ? "true" : undefined}
          className={
            target === locale
              ? "font-semibold"
              : "text-zinc-600 hover:text-foreground dark:text-zinc-400"
          }
        >
          {languageNames[target]}
        </Link>
      ))}
    </nav>
  );
}
