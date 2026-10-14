import { z } from "zod";
import type { Locale } from "@/i18n/config";
import {
  getThread,
  isCategoryFinished,
  questionIds,
  type Assessment,
  type QuestionResult,
} from "@/domain/assessment";
import { getQuestion } from "@/domain/catalog";
import { toScore } from "@/domain/scoring";
import { MAX_FOLLOW_UPS, followUpCount, type Evaluation } from "@/domain/thread";
import type { CategoryId, QuestionId } from "@/domain/types";
import { LlmError, withRetries, type LlmClient } from "./client";
import {
  completenessPrompt,
  completenessSystemPrompt,
  scoringPrompt,
  scoringSystemPrompt,
} from "./prompts";

// Every field is required: small local models tend to skip optional fields.
const completenessSchema = z.object({
  decision: z.enum(["complete", "needs_follow_up"]),
  reasoning: z.string(),
  followUpQuestion: z.string(),
});

const questionScoreSchema = z.object({
  finalAnswer: z.string(),
  notes: z.string(),
  score: z.number(),
});

// Checks whether the latest answer is complete. If the LLM fails even after
// retries, the answer is accepted rather than blocking the chat room.
export async function evaluateAnswer(
  llm: LlmClient,
  assessment: Assessment,
  questionId: QuestionId,
  locale: Locale,
): Promise<Evaluation> {
  const thread = getThread(assessment, questionId);
  if (thread.status !== "active" || thread.pending !== "evaluation") {
    throw new Error(`Question ${questionId} has no answer awaiting evaluation`);
  }
  const followUpsLeft = MAX_FOLLOW_UPS - followUpCount(thread);
  if (followUpsLeft <= 0) return { decision: "complete" };

  const question = requireQuestion(questionId);
  let result;
  try {
    result = await withRetries(() =>
      llm.generate({
        name: "completeness_check",
        system: completenessSystemPrompt(locale),
        prompt: completenessPrompt(question, thread.exchanges, locale, followUpsLeft),
        schema: completenessSchema,
      }),
    );
  } catch (error) {
    if (error instanceof LlmError) return { decision: "complete" };
    throw error;
  }

  const followUpQuestion = result.followUpQuestion.trim();
  return result.decision === "needs_follow_up" && followUpQuestion
    ? { decision: "needs_follow_up", followUpQuestion }
    : { decision: "complete" };
}

// Scores every completed question of a finished category. Throws LlmError if a
// question cannot be scored after retries; no results are made up.
export async function scoreCategory(
  llm: LlmClient,
  assessment: Assessment,
  categoryId: CategoryId,
  locale: Locale,
): Promise<Record<QuestionId, QuestionResult>> {
  if (!isCategoryFinished(assessment, categoryId)) {
    throw new Error(`Category ${categoryId} still has open questions`);
  }

  const results: Record<QuestionId, QuestionResult> = {};
  // Sequential on purpose: a local model handles one request at a time anyway.
  for (const questionId of questionIds(assessment, [categoryId])) {
    const thread = getThread(assessment, questionId);
    if (thread.status !== "completed") continue;
    const question = requireQuestion(questionId);

    results[questionId] = await withRetries(async () => {
      const output = await llm.generate({
        name: "question_score",
        system: scoringSystemPrompt(locale),
        prompt: scoringPrompt(question, thread.exchanges, locale),
        schema: questionScoreSchema,
      });
      const score = toScore(output.score);
      if (score === undefined) {
        throw new LlmError("invalid_output", `Invalid score: ${output.score}`);
      }
      return { finalAnswer: output.finalAnswer, notes: output.notes, score };
    });
  }
  return results;
}

function requireQuestion(questionId: QuestionId) {
  const question = getQuestion(questionId);
  if (!question) throw new Error(`Unknown question ${questionId}`);
  return question;
}
