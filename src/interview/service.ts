import type { Locale } from "@/i18n/config";
import {
  answerQuestion,
  applyQuestionEvaluation,
  categoriesAwaitingScoring,
  markQuestionNotApplicable,
  recordCategoryResults,
  type Assessment,
} from "@/domain/assessment";
import type { CategoryId, QuestionId, UserId } from "@/domain/types";
import { LlmError, type LlmClient } from "@/llm/client";
import { evaluateAnswer, scoreCategory } from "@/llm/tasks";

export type InterviewDeps = { llm: LlmClient };

export type InterviewResult = {
  assessment: Assessment;
  // Finished categories whose scoring failed; retry via scorePendingCategories.
  scoringFailed: CategoryId[];
};

// Records an answer, runs the completeness check and, if that finished the
// category, scores it.
export async function submitAnswer(
  deps: InterviewDeps,
  assessment: Assessment,
  input: { questionId: QuestionId; userId: UserId; text: string; locale: Locale },
): Promise<InterviewResult> {
  const answered = answerQuestion(
    assessment,
    input.questionId,
    input.userId,
    input.text,
  );
  const evaluation = await evaluateAnswer(
    deps.llm,
    answered,
    input.questionId,
    input.locale,
  );
  const evaluated = applyQuestionEvaluation(answered, input.questionId, evaluation);
  return scorePendingCategories(deps, evaluated, input.locale);
}

// Marking the last open question as not applicable also finishes a category.
export async function submitNotApplicable(
  deps: InterviewDeps,
  assessment: Assessment,
  input: { questionId: QuestionId; userId: UserId; reason: string; locale: Locale },
): Promise<InterviewResult> {
  const updated = markQuestionNotApplicable(
    assessment,
    input.questionId,
    input.userId,
    input.reason,
  );
  return scorePendingCategories(deps, updated, input.locale);
}

// Scores every finished but unscored category. Failed categories stay
// unscored and are reported, so the UI can offer a retry.
export async function scorePendingCategories(
  deps: InterviewDeps,
  assessment: Assessment,
  locale: Locale,
): Promise<InterviewResult> {
  let current = assessment;
  const scoringFailed: CategoryId[] = [];
  for (const categoryId of categoriesAwaitingScoring(assessment)) {
    try {
      const results = await scoreCategory(deps.llm, current, categoryId, locale);
      current = recordCategoryResults(current, categoryId, results);
    } catch (error) {
      if (!(error instanceof LlmError)) throw error;
      scoringFailed.push(categoryId);
    }
  }
  return { assessment: current, scoringFailed };
}
