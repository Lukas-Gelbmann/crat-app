import { describe, it, expect } from "vitest";
import {
  answerQuestion,
  applyQuestionEvaluation,
  createAssessment,
  markQuestionNotApplicable,
  type Assessment,
} from "@/domain/assessment";
import { MAX_FOLLOW_UPS } from "@/domain/thread";
import { LlmError } from "./client";
import { createFakeLlm } from "./fake";
import { evaluateAnswer, scoreCategory } from "./tasks";

const failure = () => new LlmError("invalid_output", "garbage");

function answered(text = "We use passwords."): Assessment {
  const assessment = createAssessment({
    id: "a1",
    organizationId: "org1",
    categoryIds: ["access-control"],
  });
  return answerQuestion(assessment, "ac_001", "alice", text);
}

// All access-control questions answered, ac_005 not applicable.
function finishedCategory(): Assessment {
  let a = createAssessment({ id: "a1", organizationId: "org1", categoryIds: ["access-control"] });
  for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
    a = answerQuestion(a, id, "alice", `answer to ${id}`);
    a = applyQuestionEvaluation(a, id, { decision: "complete" });
  }
  return markQuestionNotApplicable(a, "ac_005", "bob", "n/a");
}

const score = (value: unknown) => ({ finalAnswer: "summary", notes: "notes", score: value });

describe("evaluateAnswer", () => {
  it("returns a follow-up question", async () => {
    const llm = createFakeLlm([
      { decision: "needs_follow_up", reasoning: "vague", followUpQuestion: " Do you use MFA? " },
    ]);
    await expect(evaluateAnswer(llm.client, answered(), "ac_001", "en")).resolves.toEqual({
      decision: "needs_follow_up",
      followUpQuestion: "Do you use MFA?",
    });
  });

  it("returns complete", async () => {
    const llm = createFakeLlm([{ decision: "complete", reasoning: "ok", followUpQuestion: "" }]);
    await expect(evaluateAnswer(llm.client, answered(), "ac_001", "en")).resolves.toEqual({
      decision: "complete",
    });
  });

  it("treats a follow-up decision without a question as complete", async () => {
    const llm = createFakeLlm([
      { decision: "needs_follow_up", reasoning: "vague", followUpQuestion: "  " },
    ]);
    await expect(evaluateAnswer(llm.client, answered(), "ac_001", "en")).resolves.toEqual({
      decision: "complete",
    });
  });

  it("sends the question, its context and the answer in the user's language", async () => {
    const llm = createFakeLlm([{ decision: "complete", reasoning: "", followUpQuestion: "" }]);
    await evaluateAnswer(llm.client, answered("Wir nutzen Passwörter."), "ac_001", "de");
    const [request] = llm.requests;
    expect(request.system).toMatch(/written in German/);
    expect(request.prompt).toMatch(/Wie verwalten Sie die Vergabe/);
    expect(request.prompt).toMatch(/Erwartet werden formale Prozesse/);
    expect(request.prompt).toMatch(/ANSWER: Wir nutzen Passwörter\./);
    expect(request.prompt).toMatch(/Follow-up questions left: 3/);
  });

  it("accepts the answer if the LLM keeps failing", async () => {
    const llm = createFakeLlm([failure(), failure(), failure()]);
    await expect(evaluateAnswer(llm.client, answered(), "ac_001", "en")).resolves.toEqual({
      decision: "complete",
    });
    expect(llm.requests).toHaveLength(3);
  });

  it("skips the LLM once all follow-ups are used", async () => {
    let a = answered();
    for (let i = 0; i < MAX_FOLLOW_UPS; i++) {
      a = applyQuestionEvaluation(a, "ac_001", {
        decision: "needs_follow_up",
        followUpQuestion: `follow-up ${i}`,
      });
      a = answerQuestion(a, "ac_001", "alice", `answer ${i}`);
    }
    const llm = createFakeLlm([]);
    await expect(evaluateAnswer(llm.client, a, "ac_001", "en")).resolves.toEqual({
      decision: "complete",
    });
    expect(llm.requests).toHaveLength(0);
  });

  it("rejects questions without an answer awaiting evaluation", async () => {
    const llm = createFakeLlm([]);
    await expect(evaluateAnswer(llm.client, answered(), "ac_002", "en")).rejects.toThrow(
      /awaiting evaluation/,
    );
  });
});

describe("scoreCategory", () => {
  it("scores every completed question, skipping not applicable ones", async () => {
    const llm = createFakeLlm([score(4), score(4.6), score(9), score(0)]);
    const results = await scoreCategory(llm.client, finishedCategory(), "access-control", "en");
    expect(Object.keys(results)).toEqual(["ac_001", "ac_002", "ac_003", "ac_004"]);
    expect(Object.values(results).map((r) => r.score)).toEqual([4, 5, 5, 1]);
    expect(results.ac_001).toEqual({ finalAnswer: "summary", notes: "notes", score: 4 });
    expect(llm.requests[1].prompt).toMatch(/ANSWER: answer to ac_002/);
  });

  it("writes the report in the user's language", async () => {
    const llm = createFakeLlm([score(3), score(3), score(3), score(3)]);
    await scoreCategory(llm.client, finishedCategory(), "access-control", "de");
    expect(llm.requests[0].system).toMatch(/Write finalAnswer and notes in German/);
  });

  it("retries an invalid score and then succeeds", async () => {
    const llm = createFakeLlm([score("high"), score(3), score(3), score(3), score(3)]);
    const results = await scoreCategory(llm.client, finishedCategory(), "access-control", "en");
    expect(results.ac_001.score).toBe(3);
    expect(llm.requests).toHaveLength(5);
  });

  it("fails instead of inventing a score", async () => {
    const llm = createFakeLlm([score(3), failure(), failure(), failure()]);
    await expect(
      scoreCategory(llm.client, finishedCategory(), "access-control", "en"),
    ).rejects.toBeInstanceOf(LlmError);
  });

  it("rejects categories that are not finished", async () => {
    const llm = createFakeLlm([]);
    await expect(scoreCategory(llm.client, answered(), "access-control", "en")).rejects.toThrow(
      /open questions/,
    );
  });
});
