import { describe, it, expect } from "vitest";
import { createAssessment, updateThread, type Assessment } from "./assessment";
import { categoryScore, overallScore, toScore } from "./scoring";
import {
  applyEvaluation,
  completeThread,
  markNotApplicable,
  startThread,
  submitAnswer,
  type QuestionThread,
} from "./thread";
import type { Score } from "./types";

function scored(score: Score) {
  return (thread: QuestionThread) => {
    let t = submitAnswer(startThread(thread, "alice"), "alice", "answer");
    t = applyEvaluation(t, { decision: "complete" });
    return completeThread(t, { finalAnswer: "answer", notes: "", score });
  };
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
  it("is null before anything is scored", () => {
    expect(categoryScore(create(), "access-control")).toBeNull();
  });

  it("averages completed questions and excludes not applicable ones", () => {
    let assessment = create();
    assessment = updateThread(assessment, "ac_001", scored(4));
    assessment = updateThread(assessment, "ac_002", scored(2));
    assessment = updateThread(assessment, "ac_003", scored(3));
    assessment = updateThread(assessment, "ac_004", (t) =>
      markNotApplicable(t, "alice", "n/a"),
    );
    expect(categoryScore(assessment, "access-control")).toBe(3);
  });

  it("rounds to one decimal", () => {
    let assessment = create();
    assessment = updateThread(assessment, "ac_001", scored(4));
    assessment = updateThread(assessment, "ac_002", scored(4));
    assessment = updateThread(assessment, "ac_003", scored(5));
    expect(categoryScore(assessment, "access-control")).toBe(4.3);
  });
});

describe("overallScore", () => {
  it("weighs categories equally", () => {
    let assessment = create();
    // access-control: 5 questions averaging 2
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004", "ac_005"]) {
      assessment = updateThread(assessment, id, scored(2));
    }
    // data-protection: 1 question with 5
    assessment = updateThread(assessment, "dp_001", scored(5));
    expect(overallScore(assessment)).toBe(3.5);
  });

  it("ignores categories without scores and is null when nothing is scored", () => {
    expect(overallScore(create())).toBeNull();
    const assessment = updateThread(create(), "ac_001", scored(4));
    expect(overallScore(assessment)).toBe(4);
  });
});
