import { describe, it, expect } from "vitest";
import { getPathLocale, withLocale } from "./paths";

describe("getPathLocale", () => {
  it("reads the locale prefix", () => {
    expect(getPathLocale("/de")).toBe("de");
    expect(getPathLocale("/en/assessments/1")).toBe("en");
  });

  it("returns undefined without a supported prefix", () => {
    expect(getPathLocale("/")).toBeUndefined();
    expect(getPathLocale("/fr/x")).toBeUndefined();
    expect(getPathLocale("/design")).toBeUndefined();
  });
});

describe("withLocale", () => {
  it("swaps an existing prefix", () => {
    expect(withLocale("/de/assessments/1", "en")).toBe("/en/assessments/1");
  });

  it("adds a prefix when missing", () => {
    expect(withLocale("/assessments", "de")).toBe("/de/assessments");
  });

  it("handles the root path", () => {
    expect(withLocale("/", "de")).toBe("/de");
    expect(withLocale("/en", "de")).toBe("/de");
  });
});
