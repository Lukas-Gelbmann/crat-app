import { describe, it, expect } from "vitest";
import {
  AssessmentError,
  createAssessment,
  getProgress,
  getThread,
  isAssessmentComplete,
  nextQuestionFor,
  questionIds,
  updateThread,
  type Assessment,
} from "./assessment";
import {
  applyEvaluation,
  completeThread,
  markNotApplicable,
  skipThread,
  startThread,
  submitAnswer,
  type QuestionThread,
} from "./thread";

const alice = "alice";
const bob = "bob";

function create(categoryIds: string[]): Assessment {
  return createAssessment({ id: "a1", organizationId: "org1", categoryIds });
}

function complete(thread: QuestionThread, userId: string): QuestionThread {
  let t = submitAnswer(startThread(thread, userId), userId, "answer");
  t = applyEvaluation(t, { decision: "complete" });
  return completeThread(t, { finalAnswer: "answer", notes: "", score: 3 });
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
    expect(() => create(["nope"])).toThrow(AssessmentError);
    expect(() => create([])).toThrow(/at least one category/);
  });
});

describe("updateThread", () => {
  it("applies a transition without mutating the original", () => {
    const before = create(["access-control"]);
    const after = updateThread(before, "ac_001", (t) => startThread(t, alice));
    expect(getThread(after, "ac_001").status).toBe("answering");
    expect(getThread(before, "ac_001").status).toBe("open");
  });

  it("rejects questions outside the assessment", () => {
    const assessment = create(["access-control"]);
    expect(() => updateThread(assessment, "sa_001", (t) => t)).toThrow(
      /not part of assessment/,
    );
  });
});

describe("progress", () => {
  it("counts statuses overall and per category", () => {
    let assessment = create(["access-control", "data-protection"]);
    assessment = updateThread(assessment, "ac_001", (t) => complete(t, alice));
    assessment = updateThread(assessment, "ac_002", (t) => markNotApplicable(t, alice, "n/a"));
    assessment = updateThread(assessment, "ac_003", (t) => skipThread(t, alice));
    assessment = updateThread(assessment, "dp_001", (t) => startThread(t, bob));

    expect(getProgress(assessment)).toEqual({
      open: 6,
      answering: 1,
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
    for (const id of questionIds(assessment).slice(0, 4)) {
      assessment = updateThread(assessment, id, (t) => complete(t, alice));
    }
    expect(isAssessmentComplete(assessment)).toBe(false);

    assessment = updateThread(assessment, "ac_005", (t) => skipThread(t, alice));
    expect(isAssessmentComplete(assessment)).toBe(false);

    assessment = updateThread(assessment, "ac_005", (t) => markNotApplicable(t, bob, "n/a"));
    expect(isAssessmentComplete(assessment)).toBe(true);
  });
});

describe("nextQuestionFor", () => {
  it("suggests the first open question in the user's categories", () => {
    const assessment = create(["access-control", "data-protection"]);
    expect(nextQuestionFor(assessment, alice, ["data-protection"])).toBe("dp_001");
  });

  it("resumes the user's own thread first", () => {
    const assessment = updateThread(create(["access-control"]), "ac_004", (t) =>
      startThread(t, alice),
    );
    expect(nextQuestionFor(assessment, alice, ["access-control"])).toBe("ac_004");
  });

  it("skips threads locked by others and comes back to skipped ones last", () => {
    let assessment = create(["access-control"]);
    assessment = updateThread(assessment, "ac_001", (t) => skipThread(t, alice));
    assessment = updateThread(assessment, "ac_002", (t) => startThread(t, bob));
    expect(nextQuestionFor(assessment, alice, ["access-control"])).toBe("ac_003");

    for (const id of ["ac_003", "ac_004", "ac_005"]) {
      assessment = updateThread(assessment, id, (t) => complete(t, alice));
    }
    expect(nextQuestionFor(assessment, alice, ["access-control"])).toBe("ac_001");
  });

  it("returns undefined when nothing is left or no category matches", () => {
    let assessment = create(["access-control"]);
    expect(nextQuestionFor(assessment, alice, ["data-protection"])).toBeUndefined();
    for (const id of questionIds(assessment)) {
      assessment = updateThread(assessment, id, (t) => complete(t, alice));
    }
    expect(nextQuestionFor(assessment, alice, ["access-control"])).toBeUndefined();
  });
});
