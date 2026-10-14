import { describe, it, expect } from "vitest";
import { locales } from "@/i18n/config";
import {
  catalog,
  getCategory,
  getCategoryOfQuestion,
  getQuestion,
} from "./catalog";

const allQuestions = catalog.flatMap((category) => category.questions);

describe("catalog", () => {
  it("has unique category and question ids", () => {
    const categoryIds = catalog.map((c) => c.id);
    const questionIds = allQuestions.map((q) => q.id);
    expect(new Set(categoryIds).size).toBe(categoryIds.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it("has no empty categories", () => {
    for (const category of catalog) {
      expect(category.questions.length).toBeGreaterThan(0);
    }
  });

  it("has non-empty texts in every locale", () => {
    for (const locale of locales) {
      for (const category of catalog) {
        expect(category.name[locale].trim()).not.toBe("");
      }
      for (const question of allQuestions) {
        expect(question.text[locale].trim()).not.toBe("");
        expect(question.context[locale].trim()).not.toBe("");
      }
    }
  });

  it("looks up categories and questions", () => {
    expect(getCategory("access-control")?.name.en).toBe("Access Control");
    expect(getCategory("unknown")).toBeUndefined();
    expect(getQuestion("ac_002")?.text.de).toMatch(/Authentifizierung/);
    expect(getQuestion("unknown")).toBeUndefined();
    expect(getCategoryOfQuestion("ir_003")?.id).toBe("incident-response");
    expect(getCategoryOfQuestion("unknown")).toBeUndefined();
  });
});
