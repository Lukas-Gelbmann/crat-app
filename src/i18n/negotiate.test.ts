import { describe, it, expect } from "vitest";
import { negotiateLocale } from "./negotiate";

describe("negotiateLocale", () => {
  it("falls back to English without a header", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
  });

  it("matches a language with region subtag", () => {
    expect(negotiateLocale("de-AT,de;q=0.9,en;q=0.8")).toBe("de");
  });

  it("respects quality values over order", () => {
    expect(negotiateLocale("en;q=0.5,de;q=0.9")).toBe("de");
  });

  it("skips unsupported languages", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,de;q=0.7")).toBe("de");
  });

  it("falls back to English when nothing matches", () => {
    expect(negotiateLocale("fr,es;q=0.8")).toBe("en");
  });

  it("ignores languages with q=0", () => {
    expect(negotiateLocale("de;q=0,en;q=0.1")).toBe("en");
  });

  it("handles the wildcard", () => {
    expect(negotiateLocale("*")).toBe("en");
  });
});
