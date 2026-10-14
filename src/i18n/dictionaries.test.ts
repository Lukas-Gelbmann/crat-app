import { describe, it, expect } from "vitest";
import { locales } from "./config";
import { getDictionary } from "./dictionaries";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("dictionaries", () => {
  it("have the same keys in every locale", async () => {
    const english = keyPaths(await getDictionary("en")).sort();
    for (const locale of locales) {
      expect(keyPaths(await getDictionary(locale)).sort()).toEqual(english);
    }
  });

  it("have no empty strings", async () => {
    for (const locale of locales) {
      const dict = await getDictionary(locale);
      const values = keyPaths(dict).map((path) =>
        path.split(".").reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          dict,
        ),
      );
      expect(values.every((v) => typeof v === "string" && v.length > 0)).toBe(
        true,
      );
    }
  });
});
