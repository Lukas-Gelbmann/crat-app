import type { Locale } from "@/i18n/config";

export type LocalizedText = Record<Locale, string>;

export type CategoryId = string;
export type QuestionId = string;
export type UserId = string;

export type Question = {
  id: QuestionId;
  text: LocalizedText;
  // What a good answer covers; guides the LLM evaluation.
  context: LocalizedText;
};

export type Category = {
  id: CategoryId;
  name: LocalizedText;
  questions: Question[];
};

// Compliance maturity: 1 = no controls, 5 = mature with continuous improvement.
export type Score = 1 | 2 | 3 | 4 | 5;
