import { describe, it, expect } from "vitest";
import {
  categoriesAwaitingScoring,
  createAssessment,
  currentQuestion,
  getThread,
  isAssessmentComplete,
  skipQuestion,
  type Assessment,
} from "@/domain/assessment";
import { categoryScore } from "@/domain/scoring";
import { LlmError } from "@/llm/client";
import { createFakeLlm } from "@/llm/fake";
import { scorePendingCategories, submitAnswer, submitNotApplicable } from "./service";

const complete = { decision: "complete", reasoning: "ok", followUpQuestion: "" };
const followUp = (q: string) => ({ decision: "needs_follow_up", reasoning: "vague", followUpQuestion: q });
const score = (value: number) => ({ finalAnswer: "summary", notes: "notes", score: value });
const failure = () => new LlmError("request_failed", "offline");

function create(): Assessment {
  return createAssessment({ id: "a1", organizationId: "org1", categoryIds: ["access-control"] });
}

describe("interview service", () => {
  it("asks a follow-up and moves on once the answer is complete", async () => {
    const llm = createFakeLlm([followUp("Do you use MFA?"), complete]);
    const deps = { llm: llm.client };

    let result = await submitAnswer(deps, create(), {
      questionId: "ac_001", userId: "alice", text: "Passwords.", locale: "en",
    });
    expect(getThread(result.assessment, "ac_001")).toMatchObject({ status: "active", pending: "answer" });
    expect(currentQuestion(result.assessment, "access-control")).toBe("ac_001");

    result = await submitAnswer(deps, result.assessment, {
      questionId: "ac_001", userId: "bob", text: "Yes, for admins.", locale: "en",
    });
    expect(getThread(result.assessment, "ac_001").status).toBe("completed");
    expect(currentQuestion(result.assessment, "access-control")).toBe("ac_002");
    expect(result.scoringFailed).toEqual([]);
  });

  it("scores the category automatically after its last question", async () => {
    let assessment = create();
    const deps = { llm: createFakeLlm([complete, complete, complete, complete]).client };
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
      ({ assessment } = await submitAnswer(deps, assessment, {
        questionId: id, userId: "alice", text: "answer", locale: "en",
      }));
    }
    expect(categoryScore(assessment, "access-control")).toBeNull();

    const last = createFakeLlm([complete, score(4), score(3), score(5), score(4), score(2)]);
    const result = await submitAnswer({ llm: last.client }, assessment, {
      questionId: "ac_005", userId: "alice", text: "answer", locale: "en",
    });
    expect(result.scoringFailed).toEqual([]);
    expect(categoryScore(result.assessment, "access-control")).toBe(3.6);
    expect(isAssessmentComplete(result.assessment)).toBe(true);
  });

  it("scores the category when the last question is marked not applicable", async () => {
    let assessment = create();
    const deps = { llm: createFakeLlm([complete, complete, complete, complete]).client };
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
      ({ assessment } = await submitAnswer(deps, assessment, {
        questionId: id, userId: "alice", text: "answer", locale: "en",
      }));
    }
    const scoring = createFakeLlm([score(2), score(2), score(2), score(2)]);
    const result = await submitNotApplicable({ llm: scoring.client }, assessment, {
      questionId: "ac_005", userId: "bob", reason: "No privileged accounts", locale: "en",
    });
    expect(Object.keys(result.assessment.categoryResults["access-control"] ?? {})).toEqual([
      "ac_001", "ac_002", "ac_003", "ac_004",
    ]);
  });

  it("reports failed scoring and succeeds on retry", async () => {
    let assessment = create();
    const deps = { llm: createFakeLlm([complete, complete, complete, complete]).client };
    for (const id of ["ac_001", "ac_002", "ac_003", "ac_004"]) {
      ({ assessment } = await submitAnswer(deps, assessment, {
        questionId: id, userId: "alice", text: "answer", locale: "en",
      }));
    }
    const offline = createFakeLlm([failure(), failure(), failure()]);
    let result = await submitNotApplicable({ llm: offline.client }, assessment, {
      questionId: "ac_005", userId: "bob", reason: "n/a", locale: "en",
    });
    expect(result.scoringFailed).toEqual(["access-control"]);
    expect(categoriesAwaitingScoring(result.assessment)).toEqual(["access-control"]);
    expect(categoryScore(result.assessment, "access-control")).toBeNull();

    const online = createFakeLlm([score(3), score(3), score(3), score(3)]);
    result = await scorePendingCategories({ llm: online.client }, result.assessment, "en");
    expect(result.scoringFailed).toEqual([]);
    expect(categoryScore(result.assessment, "access-control")).toBe(3);
  });

  it("does not score while skipped questions remain", async () => {
    let assessment = skipQuestion(create(), "ac_001");
    const deps = { llm: createFakeLlm([complete, complete, complete, complete]).client };
    for (const id of ["ac_002", "ac_003", "ac_004", "ac_005"]) {
      ({ assessment } = await submitAnswer(deps, assessment, {
        questionId: id, userId: "alice", text: "answer", locale: "en",
      }));
    }
    expect(currentQuestion(assessment, "access-control")).toBe("ac_001");
    expect(categoriesAwaitingScoring(assessment)).toEqual([]);
  });
});
