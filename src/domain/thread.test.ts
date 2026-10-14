import { describe, it, expect } from "vitest";
import {
  MAX_FOLLOW_UPS,
  ThreadError,
  applyEvaluation,
  completeThread,
  createThread,
  followUpCount,
  markNotApplicable,
  reopenThread,
  skipThread,
  startThread,
  submitAnswer,
  type QuestionThread,
  type ThreadResult,
} from "./thread";

const alice = "alice";
const bob = "bob";
const result: ThreadResult = { finalAnswer: "MFA everywhere", notes: "", score: 4 };

function answering(): QuestionThread {
  return startThread(createThread("ac_002"), alice);
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
    let thread = answering();
    expect(thread).toMatchObject({ status: "answering", pending: "answer", assigneeId: alice });

    thread = submitAnswer(thread, alice, "  We use MFA.  ");
    expect(thread).toMatchObject({ pending: "evaluation" });
    expect(thread.exchanges).toEqual([
      { prompt: { kind: "catalog" }, answer: { text: "We use MFA.", authorId: alice } },
    ]);

    thread = applyEvaluation(thread, { decision: "complete" });
    expect(thread).toMatchObject({ pending: "finalization" });

    thread = completeThread(thread, result);
    expect(thread).toMatchObject({ status: "completed", result, completedBy: alice });
  });

  it("adds follow-ups until the evaluation is complete", () => {
    let thread = submitAnswer(answering(), alice, "Passwords.");
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

    thread = submitAnswer(thread, alice, "Yes, for admins.");
    thread = applyEvaluation(thread, { decision: "complete" });
    expect(thread).toMatchObject({ pending: "finalization" });
    expect(thread.exchanges).toHaveLength(2);
  });

  it(`stops asking after ${MAX_FOLLOW_UPS} follow-ups`, () => {
    let thread = answering();
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
    expect(thread).toMatchObject({ pending: "finalization" });
    expect(followUpCount(thread)).toBe(MAX_FOLLOW_UPS);
  });

  it("locks the thread to its assignee", () => {
    const thread = answering();
    expectError(() => submitAnswer(thread, bob, "Hi"), "not_assignee");
    expectError(() => skipThread(thread, bob), "not_assignee");
    expectError(() => startThread(thread, bob), "invalid_transition");
  });

  it("skips and resumes with the answers given so far", () => {
    let thread = submitAnswer(answering(), alice, "Passwords.");
    thread = applyEvaluation(thread, {
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
    thread = skipThread(thread, alice);
    expect(thread.status).toBe("skipped");
    expect(thread.exchanges).toHaveLength(2);

    thread = startThread(thread, bob);
    expect(thread).toMatchObject({ status: "answering", assigneeId: bob, pending: "answer" });
    thread = submitAnswer(thread, bob, "Yes.");
    expect(thread.exchanges.map((e) => e.answer?.authorId)).toEqual([alice, bob]);
  });

  it("skips an open thread directly", () => {
    expect(skipThread(createThread("ac_002"), alice).status).toBe("skipped");
  });

  it("does not skip while an answer is being evaluated", () => {
    const thread = submitAnswer(answering(), alice, "Passwords.");
    expectError(() => skipThread(thread, alice), "invalid_transition");
  });

  it("marks a question as not applicable with a reason", () => {
    const thread = markNotApplicable(createThread("ac_002"), alice, " No IT systems ");
    expect(thread).toMatchObject({
      status: "not_applicable",
      reason: "No IT systems",
      decidedBy: alice,
    });
    expectError(() => markNotApplicable(createThread("ac_002"), alice, " "), "empty_text");
    expectError(() => markNotApplicable(answering(), bob, "x"), "not_assignee");
  });

  it("rejects empty answers and follow-ups", () => {
    expectError(() => submitAnswer(answering(), alice, "   "), "empty_text");
    const evaluating = submitAnswer(answering(), alice, "x");
    expectError(
      () => applyEvaluation(evaluating, { decision: "needs_follow_up", followUpQuestion: "" }),
      "empty_text",
    );
  });

  it("rejects steps out of order", () => {
    const open = createThread("ac_002");
    expectError(() => submitAnswer(open, alice, "x"), "invalid_transition");
    expectError(() => applyEvaluation(answering(), { decision: "complete" }), "invalid_transition");
    expectError(() => completeThread(answering(), result), "invalid_transition");
    expectError(() => reopenThread(open), "invalid_transition");
  });

  it("reopens finished threads from scratch", () => {
    let thread = submitAnswer(answering(), alice, "x");
    thread = completeThread(applyEvaluation(thread, { decision: "complete" }), result);
    expect(reopenThread(thread)).toEqual(createThread("ac_002"));
    expect(
      reopenThread(markNotApplicable(createThread("ac_002"), alice, "n/a")),
    ).toEqual(createThread("ac_002"));
  });
});
