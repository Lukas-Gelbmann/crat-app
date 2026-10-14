import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSwitcher } from "./language-switcher";

vi.mock("next/navigation", () => ({
  usePathname: () => "/de/assessments",
}));

describe("LanguageSwitcher", () => {
  it("links each language to the current page and marks the active one", () => {
    render(
      <LanguageSwitcher
        locale="de"
        label="Sprache"
        languageNames={{ en: "English", de: "Deutsch" }}
      />,
    );

    const english = screen.getByRole("link", { name: "English" });
    const german = screen.getByRole("link", { name: "Deutsch" });
    expect(english.getAttribute("href")).toBe("/en/assessments");
    expect(german.getAttribute("href")).toBe("/de/assessments");
    expect(german.getAttribute("aria-current")).toBe("true");
    expect(english.getAttribute("aria-current")).toBeNull();
  });
});
