import { describe, it, expect } from "vitest";
import {
  answerQuestion,
  applyQuestionEvaluation,
  createAssessment,
  markQuestionNotApplicable,
  questionIds,
  recordCategoryResults,
  type Assessment,
} from "./assessment";
import { categoryScore, overallScore, toScore } from "./scoring";
import type { Score } from "./types";

// Finishes every question of a category and records the given scores;
// questions without a score are marked not applicable.
function scoreCategory(
  assessment: Assessment,
  categoryId: string,
  scores: Record<string, Score>,
): Assessment {
  let a = assessment;
  for (const id of questionIds(a, [categoryId])) {
    if (id in scores) {
      a = answerQuestion(a, id, "alice", "answer");
      a = applyQuestionEvaluation(a, id, { decision: "complete" });
    } else {
      a = markQuestionNotApplicable(a, id, "alice", "n/a");
    }
  }
  const results = Object.fromEntries(
    Object.entries(scores).map(([id, score]) => [
      id,
      { finalAnswer: "answer", notes: "", score },
    ]),
  );
  return recordCategoryResults(a, categoryId, results);
}

function create(): Assessment {
  return createAssessment({
    id: "a1",
    organizationId: "org1",
    categoryIds: ["access-control", "data-protection"],
  });
}

describe("toScore", () => {
  it("accepts valid scores", () => {
    expect(toScore(1)).toBe(1);
    expect(toScore(5)).toBe(5);
    expect(toScore("4")).toBe(4);
  });

  it("rounds and clamps numbers", () => {
    expect(toScore(3.6)).toBe(4);
    expect(toScore(0)).toBe(1);
    expect(toScore(9)).toBe(5);
    expect(toScore(" 2 ")).toBe(2);
  });

  it("rejects non-numeric values", () => {
    for (const value of [undefined, null, "", "high", NaN, Infinity, {}, [3]]) {
      expect(toScore(value)).toBeUndefined();
    }
  });
});

describe("categoryScore", () => {
  it("is null until the category is scored", () => {
    let assessment = create();
    expect(categoryScore(assessment, "access-control")).toBeNull();
    assessment = answerQuestion(assessment, "ac_001", "alice", "answer");
    assessment = applyQuestionEvaluation(assessment, "ac_001", { decision: "complete" });
    expect(categoryScore(assessment, "access-control")).toBeNull();
  });

  it("averages scored questions; not applicable ones have no score", () => {
    const assessment = scoreCategory(create(), "access-control", {
      ac_001: 4,
      ac_002: 2,
      ac_003: 3,
    });
    expect(categoryScore(assessment, "access-control")).toBe(3);
  });

  it("rounds to one decimal", () => {
    const assessment = scoreCategory(create(), "access-control", {
      ac_001: 4,
      ac_002: 4,
      ac_003: 5,
    });
    expect(categoryScore(assessment, "access-control")).toBe(4.3);
  });

  it("is null for a category where every question is not applicable", () => {
    const assessment = scoreCategory(create(), "access-control", {});
    expect(categoryScore(assessment, "access-control")).toBeNull();
  });
});

describe("overallScore", () => {
  it("weighs categories equally", () => {
    let assessment = scoreCategory(create(), "access-control", {
      ac_001: 2,
      ac_002: 2,
      ac_003: 2,
      ac_004: 2,
      ac_005: 2,
    });
    assessment = scoreCategory(assessment, "data-protection", { dp_001: 5 });
    expect(overallScore(assessment)).toBe(3.5);
  });

  it("ignores unscored categories and is null when nothing is scored", () => {
    expect(overallScore(create())).toBeNull();
    const assessment = scoreCategory(create(), "access-control", { ac_001: 4 });
    expect(overallScore(assessment)).toBe(4);
  });
});
