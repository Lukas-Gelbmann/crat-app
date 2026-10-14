import { NextResponse, type NextRequest } from "next/server";
import { negotiateLocale } from "@/i18n/negotiate";
import { getPathLocale, withLocale } from "@/i18n/paths";

// Redirects paths without a locale prefix to the user's preferred language,
// e.g. "/" -> "/de" for a German browser.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (getPathLocale(pathname)) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = withLocale(pathname, locale);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Skip API routes, Next.js internals and files with an extension.
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
