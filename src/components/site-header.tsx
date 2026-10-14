import Link from "next/link";
import { getCurrentDictionary, getLocale } from "@/i18n/server";
import { LanguageSwitcher } from "./language-switcher";

export async function SiteHeader() {
  const locale = await getLocale();
  const dict = await getCurrentDictionary();

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
        <Link
          href={`/${locale}`}
          aria-label={dict.header.home}
          className="font-semibold tracking-tight"
        >
          CRAT
        </Link>
        <LanguageSwitcher
          locale={locale}
          label={dict.header.language}
          languageNames={dict.languages}
        />
      </div>
    </header>
  );
}
