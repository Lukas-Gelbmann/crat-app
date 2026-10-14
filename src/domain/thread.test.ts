import { describe, it, expect } from "vitest";
import {
  MAX_FOLLOW_UPS,
  ThreadError,
  activateThread,
  applyEvaluation,
  createThread,
  followUpCount,
  markNotApplicable,
  reopenThread,
  skipThread,
  submitAnswer,
  type QuestionThread,
} from "./thread";

const alice = "alice";
const bob = "bob";

function active(): QuestionThread {
  return activateThread(createThread("ac_002"));
}

function expectError(fn: () => unknown, code: ThreadError["code"]) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ThreadError);
    expect((error as ThreadError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ThreadError ${code}`);
}

describe("question thread", () => {
  it("runs the happy path without follow-ups", () => {
    let thread = active();
    expect(thread).toMatchObject({ status: "active", pending: "answer" });

    thread = submitAnswer(thread, alice, "  We use MFA.  ");
    expect(thread).toMatchObject({ pending: "evaluation" });
    expect(thread.exchanges).toEqual([
      { prompt: { kind: "catalog" }, answer: { text: "We use MFA.", authorId: alice } },
    ]);

    thread = applyEvaluation(thread, { decision: "complete" });
    expect(thread.status).toBe("completed");
    expect(thread.exchanges).toHaveLength(1);
  });

  it("lets different users answer follow-ups in the shared room", () => {
    let thread = submitAnswer(active(), alice, "Passwords.");
    thread = applyEvaluation(thread, {
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
    expect(thread).toMatchObject({ pending: "answer" });
    expect(thread.exchanges.at(-1)).toEqual({
      prompt: { kind: "follow_up", text: "Do you use MFA?" },
      answer: null,
    });
    expect(followUpCount(thread)).toBe(1);

    thread = submitAnswer(thread, bob, "Yes, for admins.");
    expect(thread.exchanges.map((e) => e.answer?.authorId)).toEqual([alice, bob]);
    thread = applyEvaluation(thread, { decision: "complete" });
    expect(thread.status).toBe("completed");
  });

  it("rejects a second answer while the first is being evaluated", () => {
    const thread = submitAnswer(active(), alice, "Passwords.");
    expectError(() => submitAnswer(thread, bob, "MFA."), "invalid_transition");
  });

  it(`stops asking after ${MAX_FOLLOW_UPS} follow-ups`, () => {
    let thread = active();
    for (let i = 0; i < MAX_FOLLOW_UPS; i++) {
      thread = submitAnswer(thread, alice, `answer ${i}`);
      thread = applyEvaluation(thread, {
        decision: "needs_follow_up",
        followUpQuestion: `follow-up ${i}`,
      });
    }
    expect(followUpCount(thread)).toBe(MAX_FOLLOW_UPS);

    thread = submitAnswer(thread, alice, "last answer");
    thread = applyEvaluation(thread, {
      decision: "needs_follow_up",
      followUpQuestion: "one more?",
    });
    expect(thread.status).toBe("completed");
    expect(followUpCount(thread)).toBe(MAX_FOLLOW_UPS);
  });

  it("skips and resumes with the answers given so far", () => {
    let thread = submitAnswer(active(), alice, "Passwords.");
    thread = applyEvaluation(thread, {
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
    thread = skipThread(thread, 1);
    expect(thread).toMatchObject({ status: "skipped", skipOrder: 1 });
    expect(thread.exchanges).toHaveLength(2);

    thread = activateThread(thread);
    expect(thread).toMatchObject({ status: "active", pending: "answer" });
    expect(thread.exchanges).toHaveLength(2);
  });

  it("skips open and already skipped threads", () => {
    const skipped = skipThread(createThread("ac_002"), 1);
    expect(skipped).toMatchObject({ status: "skipped", skipOrder: 1 });
    expect(skipThread(skipped, 2)).toMatchObject({ skipOrder: 2 });
  });

  it("does not skip while an answer is being evaluated", () => {
    const thread = submitAnswer(active(), alice, "Passwords.");
    expectError(() => skipThread(thread, 1), "invalid_transition");
  });

  it("marks a question as not applicable with a reason", () => {
    const thread = markNotApplicable(active(), alice, " No IT systems ");
    expect(thread).toMatchObject({
      status: "not_applicable",
      reason: "No IT systems",
      decidedBy: alice,
    });
    expectError(() => markNotApplicable(createThread("ac_002"), alice, " "), "empty_text");
  });

  it("rejects empty answers and follow-ups", () => {
    expectError(() => submitAnswer(active(), alice, "   "), "empty_text");
    const evaluating = submitAnswer(active(), alice, "x");
    expectError(
      () => applyEvaluation(evaluating, { decision: "needs_follow_up", followUpQuestion: "" }),
      "empty_text",
    );
  });

  it("rejects steps out of order", () => {
    const open = createThread("ac_002");
    expectError(() => submitAnswer(open, alice, "x"), "invalid_transition");
    expectError(() => activateThread(active()), "invalid_transition");
    expectError(() => applyEvaluation(active(), { decision: "complete" }), "invalid_transition");
    expectError(() => reopenThread(open), "invalid_transition");
  });

  it("reopens finished threads from scratch", () => {
    const thread = applyEvaluation(submitAnswer(active(), alice, "x"), {
      decision: "complete",
    });
    expect(reopenThread(thread)).toEqual(createThread("ac_002"));
    expect(
      reopenThread(markNotApplicable(createThread("ac_002"), alice, "n/a")),
    ).toEqual(createThread("ac_002"));
  });
});
