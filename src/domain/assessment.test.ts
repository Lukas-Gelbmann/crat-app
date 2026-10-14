import { describe, it, expect } from "vitest";
import {
  AssessmentError,
  answerQuestion,
  applyQuestionEvaluation,
  completeQuestion,
  createAssessment,
  currentQuestion,
  getProgress,
  getThread,
  isAssessmentComplete,
  markQuestionNotApplicable,
  questionIds,
  reopenQuestion,
  skipQuestion,
  type Assessment,
} from "./assessment";

const alice = "alice";
const bob = "bob";

function create(categoryIds: string[]): Assessment {
  return createAssessment({ id: "a1", organizationId: "org1", categoryIds });
}

function finish(assessment: Assessment, questionId: string): Assessment {
  let a = answerQuestion(assessment, questionId, alice, "answer");
  a = applyQuestionEvaluation(a, questionId, { decision: "complete" });
  return completeQuestion(a, questionId, { finalAnswer: "answer", notes: "", score: 3 });
}

function expectError(fn: () => unknown, code: AssessmentError["code"]) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AssessmentError);
    expect((error as AssessmentError).code).toBe(code);
    return;
  }
  throw new Error(`Expected AssessmentError ${code}`);
}

describe("createAssessment", () => {
  it("creates open threads for the selected categories in catalog order", () => {
    const assessment = create(["security-awareness", "access-control"]);
    expect(assessment.categoryIds).toEqual(["access-control", "security-awareness"]);
    expect(questionIds(assessment)).toEqual([
      "ac_001", "ac_002", "ac_003", "ac_004", "ac_005",
      "sa_001", "sa_002", "sa_003", "sa_004", "sa_005",
    ]);
    expect(Object.values(assessment.threads).every((t) => t.status === "open")).toBe(true);
  });

  it("ignores duplicate categories", () => {
    expect(create(["access-control", "access-control"]).categoryIds).toEqual([
      "access-control",
    ]);
  });

  it("rejects unknown or missing categories", () => {
    expectError(() => create(["nope"]), "unknown_category");
    expectError(() => create([]), "no_categories");
  });
});

describe("category chat room", () => {
  it("starts with the first question of each category", () => {
    const assessment = create(["access-control", "data-protection"]);
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");
    expect(currentQuestion(assessment, "data-protection")).toBe("dp_001");
  });

  it("moves through the questions strictly in order", () => {
    let assessment = create(["access-control"]);
    assessment = finish(assessment, "ac_001");
    expect(currentQuestion(assessment, "access-control")).toBe("ac_002");
  });

  it("stays on a question while it is discussed, across users", () => {
    let assessment = answerQuestion(create(["access-control"]), "ac_001", alice, "Passwords.");
    assessment = applyQuestionEvaluation(assessment, "ac_001", {
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");

    assessment = answerQuestion(assessment, "ac_001", bob, "Yes.");
    expect(getThread(assessment, "ac_001").exchanges.map((e) => e.answer?.authorId)).toEqual([
      alice,
      bob,
    ]);
  });

  it("rejects actions on any question other than the current one", () => {
    const assessment = create(["access-control"]);
    expectError(() => answerQuestion(assessment, "ac_002", alice, "x"), "not_current");
    expectError(() => skipQuestion(assessment, "ac_003"), "not_current");
    expectError(() => markQuestionNotApplicable(assessment, "ac_004", alice, "n/a"), "not_current");
  });

  it("rejects a stale answer after the room moved on", () => {
    const assessment = finish(create(["access-control"]), "ac_001");
    expectError(() => answerQuestion(assessment, "ac_001", bob, "late"), "not_current");
  });

  it("works on categories independently", () => {
    let assessment = create(["access-control", "data-protection"]);
    assessment = finish(assessment, "dp_001");
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");
    expect(currentQuestion(assessment, "data-protection")).toBe("dp_002");
  });

  it("comes back to skipped questions after the open ones, in skip order", () => {
    let assessment = create(["access-control"]);
    assessment = skipQuestion(assessment, "ac_001");
    expect(currentQuestion(assessment, "access-control")).toBe("ac_002");
    assessment = skipQuestion(assessment, "ac_002");
    for (const id of ["ac_003", "ac_004", "ac_005"]) {
      assessment = finish(assessment, id);
    }
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");

    // Skipping again moves it behind the other skipped question.
    assessment = skipQuestion(assessment, "ac_001");
    expect(currentQuestion(assessment, "access-control")).toBe("ac_002");
  });

  it("resumes a skipped question with its earlier answers", () => {
    let assessment = answerQuestion(create(["access-control"]), "ac_001", alice, "Passwords.");
    assessment = applyQuestionEvaluation(assessment, "ac_001", {
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
    assessment = skipQuestion(assessment, "ac_001");
    for (const id of ["ac_002", "ac_003", "ac_004", "ac_005"]) {
      assessment = finish(assessment, id);
    }
    assessment = answerQuestion(assessment, "ac_001", bob, "Yes.");
    expect(getThread(assessment, "ac_001").exchanges).toHaveLength(2);
  });

  it("is finished when no question is left", () => {
    let assessment = create(["access-control"]);
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
      assessment = finish(assessment, id);
    }
    assessment = markQuestionNotApplicable(assessment, "ac_005", bob, "n/a");
    expect(currentQuestion(assessment, "access-control")).toBeUndefined();
  });

  it("puts a reopened question back into the queue without interrupting", () => {
    let assessment = finish(create(["access-control"]), "ac_001");
    assessment = answerQuestion(assessment, "ac_002", alice, "x");
    assessment = reopenQuestion(assessment, "ac_001");
    expect(currentQuestion(assessment, "access-control")).toBe("ac_002");

    assessment = applyQuestionEvaluation(assessment, "ac_002", { decision: "complete" });
    assessment = completeQuestion(assessment, "ac_002", { finalAnswer: "x", notes: "", score: 2 });
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");
  });

  it("rejects questions outside the assessment", () => {
    expectError(() => answerQuestion(create(["access-control"]), "sa_001", alice, "x"), "unknown_question");
  });
});

describe("progress", () => {
  it("counts statuses overall and per category", () => {
    let assessment = create(["access-control", "data-protection"]);
    assessment = finish(assessment, "ac_001");
    assessment = markQuestionNotApplicable(assessment, "ac_002", alice, "n/a");
    assessment = skipQuestion(assessment, "ac_003");
    assessment = answerQuestion(assessment, "dp_001", bob, "x");

    expect(getProgress(assessment)).toEqual({
      open: 6,
      active: 1,
      skipped: 1,
      not_applicable: 1,
      completed: 1,
      total: 10,
      done: 2,
    });
    expect(getProgress(assessment, ["access-control"])).toMatchObject({
      total: 5,
      done: 2,
      open: 2,
    });
  });

  it("is complete only when every question is completed or not applicable", () => {
    let assessment = create(["access-control"]);
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
      assessment = finish(assessment, id);
    }
    expect(isAssessmentComplete(assessment)).toBe(false);

    assessment = skipQuestion(assessment, "ac_005");
    expect(isAssessmentComplete(assessment)).toBe(false);

    assessment = markQuestionNotApplicable(assessment, "ac_005", bob, "n/a");
    expect(isAssessmentComplete(assessment)).toBe(true);
  });
});
