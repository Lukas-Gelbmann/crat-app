// Opt-in check against a real model, configured like the app (LLM_* env vars).
// Run with `npm run test:llm`; skipped in `npm run test` and CI.
import { describe, it, expect } from "vitest";
import {
  answerQuestion,
  applyQuestionEvaluation,
  createAssessment,
  markQuestionNotApplicable,
} from "@/domain/assessment";
import { parseServerEnv } from "@/env";
import { createLlmClient } from "./index";
import { evaluateAnswer, scoreCategory } from "./tasks";

const live = process.env.LLM_LIVE === "1";

describe.skipIf(!live)("live LLM", () => {
  const env = parseServerEnv(process.env);
  const llm = createLlmClient(env);
  const assessment = createAssessment({
    id: "live",
    organizationId: "org",
    categoryIds: ["access-control"],
  });

  it(`asks a follow-up for a vague answer (${env.LLM_MODEL})`, { timeout: 180_000 }, async () => {
    const answered = answerQuestion(assessment, "ac_001", "alice", "We have some process.");
    const evaluation = await evaluateAnswer(llm, answered, "ac_001", "en");
    console.log("completeness check:", evaluation);
    expect(evaluation.decision).toBe("needs_follow_up");
  });

  it("scores a finished category in German", { timeout: 300_000 }, async () => {
    let a = answerQuestion(
      assessment,
      "ac_001",
      "alice",
      "Zugänge werden über ein Ticket beantragt, vom Vorgesetzten genehmigt und beim Austritt am letzten Arbeitstag automatisch über das HR-System entzogen.",
    );
    a = applyQuestionEvaluation(a, "ac_001", { decision: "complete" });
    for (const id of ["ac_002", "ac_003", "ac_004", "ac_005"]) {
      a = markQuestionNotApplicable(a, id, "alice", "not part of this test");
    }
    const results = await scoreCategory(llm, a, "access-control", "de");
    console.log("score:", results.ac_001);
    expect(results.ac_001.score).toBeGreaterThanOrEqual(1);
    expect(results.ac_001.score).toBeLessThanOrEqual(5);
    expect(results.ac_001.finalAnswer).not.toBe("");
  });
});
