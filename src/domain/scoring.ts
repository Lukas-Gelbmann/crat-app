import type { Assessment } from "./assessment";
import type { CategoryId, Score } from "./types";

// Normalizes an untrusted score (e.g. from an LLM): numbers and numeric strings
// are rounded and clamped to 1–5; anything else is rejected.
export function toScore(value: unknown): Score | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;
  if (!Number.isFinite(number)) return undefined;
  return Math.min(5, Math.max(1, Math.round(number))) as Score;
}

// Average score of the category's scored questions, rounded to one decimal.
// Not-applicable questions have no result; null until the category is scored.
export function categoryScore(
  assessment: Assessment,
  categoryId: CategoryId,
): number | null {
  const results = assessment.categoryResults[categoryId];
  if (!results) return null;
  return average(Object.values(results).map((result) => result.score));
}

// Average of the category scores, so every category weighs the same
// regardless of how many questions it has.
export function overallScore(assessment: Assessment): number | null {
  const scores = assessment.categoryIds.flatMap((id) => {
    const score = categoryScore(assessment, id);
    return score === null ? [] : [score];
  });
  return average(scores);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
