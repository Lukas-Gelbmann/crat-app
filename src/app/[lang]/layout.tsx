import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { locales } from "@/i18n/config";
import { getCurrentDictionary, getLocale } from "@/i18n/server";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getCurrentDictionary();
  return {
    title: {
      template: "%s | CRAT",
      default: dict.metadata.title,
    },
    description: dict.metadata.description,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  return (
    <html
      lang={await getLocale()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
