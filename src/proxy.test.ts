// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

function request(path: string, acceptLanguage?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });
}

describe("proxy", () => {
  it("redirects the root path to the preferred locale", () => {
    const response = proxy(request("/", "de-DE,de;q=0.9"));
    expect(getRedirectUrl(response!)).toBe("http://localhost:3000/de");
  });

  it("keeps path and query when adding the locale", () => {
    const response = proxy(request("/assessments?x=1"));
    expect(getRedirectUrl(response!)).toBe(
      "http://localhost:3000/en/assessments?x=1",
    );
  });

  it("passes through paths that already have a locale", () => {
    expect(proxy(request("/de/assessments"))).toBeUndefined();
  });

  it("does not run for static files and internals", () => {
    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });
    expect(matches("/")).toBe(true);
    expect(matches("/assessments")).toBe(true);
    expect(matches("/favicon.ico")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/api/health")).toBe(false);
  });
});
