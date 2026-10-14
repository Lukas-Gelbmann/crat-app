import { catalog, getCategoryOfQuestion } from "./catalog";
import {
  activateThread,
  applyEvaluation,
  createThread,
  markNotApplicable,
  reopenThread,
  skipThread,
  submitAnswer,
  type Evaluation,
  type QuestionThread,
  type ThreadStatus,
} from "./thread";
import type { CategoryId, QuestionId, Score, UserId } from "./types";

// LLM assessment of one answered question, produced when its category is scored.
export type QuestionResult = {
  finalAnswer: string;
  notes: string;
  score: Score;
};

// Each category is one shared chat room: everyone responsible for it works
// through its questions strictly in order, one current question at a time.
// Once all its questions are done, the category is scored as a whole.
export type Assessment = {
  id: string;
  organizationId: string;
  // Selected categories, in catalog order.
  categoryIds: CategoryId[];
  threads: Record<QuestionId, QuestionThread>;
  // Results per completed question, present once the category is scored.
  categoryResults: Partial<Record<CategoryId, Record<QuestionId, QuestionResult>>>;
};

export type Progress = Record<ThreadStatus, number> & {
  total: number;
  // Completed or not applicable.
  done: number;
};

export class AssessmentError extends Error {
  constructor(
    readonly code:
      | "unknown_category"
      | "no_categories"
      | "unknown_question"
      | "not_current"
      | "category_not_finished"
      | "incomplete_results",
    message: string,
  ) {
    super(message);
    this.name = "AssessmentError";
  }
}

export function createAssessment(input: {
  id: string;
  organizationId: string;
  categoryIds: CategoryId[];
}): Assessment {
  const unknown = input.categoryIds.filter(
    (id) => !catalog.some((category) => category.id === id),
  );
  if (unknown.length > 0) {
    throw new AssessmentError(
      "unknown_category",
      `Unknown categories: ${unknown.join(", ")}`,
    );
  }

  const categories = catalog.filter((c) => input.categoryIds.includes(c.id));
  if (categories.length === 0) {
    throw new AssessmentError("no_categories", "Select at least one category");
  }

  const threads: Record<QuestionId, QuestionThread> = {};
  for (const question of categories.flatMap((c) => c.questions)) {
    threads[question.id] = createThread(question.id);
  }

  return {
    id: input.id,
    organizationId: input.organizationId,
    categoryIds: categories.map((c) => c.id),
    threads,
    categoryResults: {},
  };
}

// Question ids in interview (catalog) order, optionally for some categories only.
export function questionIds(
  assessment: Assessment,
  categoryIds: readonly CategoryId[] = assessment.categoryIds,
): QuestionId[] {
  return catalog
    .filter(
      (c) => assessment.categoryIds.includes(c.id) && categoryIds.includes(c.id),
    )
    .flatMap((c) => c.questions.map((q) => q.id));
}

export function getThread(
  assessment: Assessment,
  questionId: QuestionId,
): QuestionThread {
  const thread = assessment.threads[questionId];
  if (!thread) {
    throw new AssessmentError(
      "unknown_question",
      `Question ${questionId} is not part of assessment ${assessment.id}`,
    );
  }
  return thread;
}

// The question the category's chat room is on: the active one, otherwise the
// first open question in catalog order, otherwise skipped questions in the
// order they were skipped. Undefined once the category is finished.
export function currentQuestion(
  assessment: Assessment,
  categoryId: CategoryId,
): QuestionId | undefined {
  const threads = questionIds(assessment, [categoryId]).map((id) =>
    getThread(assessment, id),
  );
  const skipped = threads
    .flatMap((t) => (t.status === "skipped" ? [t] : []))
    .sort((a, b) => a.skipOrder - b.skipOrder);
  return (
    threads.find((t) => t.status === "active") ??
    threads.find((t) => t.status === "open") ??
    skipped[0]
  )?.questionId;
}

// Commands. Each takes the question id the user acted on and rejects it if the
// room has moved on in the meantime (e.g. two people answering at once).

export function answerQuestion(
  assessment: Assessment,
  questionId: QuestionId,
  userId: UserId,
  text: string,
): Assessment {
  return updateCurrent(assessment, questionId, (thread) =>
    submitAnswer(
      thread.status === "active" ? thread : activateThread(thread),
      userId,
      text,
    ),
  );
}

export function applyQuestionEvaluation(
  assessment: Assessment,
  questionId: QuestionId,
  evaluation: Evaluation,
): Assessment {
  return updateCurrent(assessment, questionId, (thread) =>
    applyEvaluation(thread, evaluation),
  );
}

export function skipQuestion(
  assessment: Assessment,
  questionId: QuestionId,
): Assessment {
  const lastSkip = Math.max(
    0,
    ...Object.values(assessment.threads).map((t) =>
      t.status === "skipped" ? t.skipOrder : 0,
    ),
  );
  return updateCurrent(assessment, questionId, (thread) =>
    skipThread(thread, lastSkip + 1),
  );
}

export function markQuestionNotApplicable(
  assessment: Assessment,
  questionId: QuestionId,
  userId: UserId,
  reason: string,
): Assessment {
  return updateCurrent(assessment, questionId, (thread) =>
    markNotApplicable(thread, userId, reason),
  );
}

// Reopening works on any finished question; it rejoins the queue as open and
// discards the category's scores, which are recalculated once it is done again.
export function reopenQuestion(
  assessment: Assessment,
  questionId: QuestionId,
): Assessment {
  const reopened = setThread(
    assessment,
    reopenThread(getThread(assessment, questionId)),
  );
  const categoryResults = { ...reopened.categoryResults };
  delete categoryResults[categoryOf(questionId)];
  return { ...reopened, categoryResults };
}

// A category is finished when every question is completed or not applicable.
export function isCategoryFinished(
  assessment: Assessment,
  categoryId: CategoryId,
): boolean {
  return currentQuestion(assessment, categoryId) === undefined;
}

// Finished categories that still need scoring, e.g. after a failed LLM call.
export function categoriesAwaitingScoring(assessment: Assessment): CategoryId[] {
  return assessment.categoryIds.filter(
    (id) => isCategoryFinished(assessment, id) && !assessment.categoryResults[id],
  );
}

// Stores the scores of a finished category: one result per completed question
// (not-applicable questions are not scored).
export function recordCategoryResults(
  assessment: Assessment,
  categoryId: CategoryId,
  results: Record<QuestionId, QuestionResult>,
): Assessment {
  if (!isCategoryFinished(assessment, categoryId)) {
    throw new AssessmentError(
      "category_not_finished",
      `Category ${categoryId} still has open questions`,
    );
  }
  const expected = questionIds(assessment, [categoryId]).filter(
    (id) => getThread(assessment, id).status === "completed",
  );
  const given = Object.keys(results);
  if (
    given.length !== expected.length ||
    !expected.every((id) => id in results)
  ) {
    throw new AssessmentError(
      "incomplete_results",
      `Expected results for ${expected.join(", ")}, got ${given.join(", ")}`,
    );
  }
  const trimmed = Object.fromEntries(
    Object.entries(results).map(([id, result]) => [
      id,
      { ...result, finalAnswer: result.finalAnswer.trim(), notes: result.notes.trim() },
    ]),
  );
  return {
    ...assessment,
    categoryResults: { ...assessment.categoryResults, [categoryId]: trimmed },
  };
}

export function getProgress(
  assessment: Assessment,
  categoryIds?: readonly CategoryId[],
): Progress {
  const progress: Progress = {
    open: 0,
    active: 0,
    skipped: 0,
    not_applicable: 0,
    completed: 0,
    total: 0,
    done: 0,
  };
  for (const id of questionIds(assessment, categoryIds)) {
    progress[getThread(assessment, id).status] += 1;
    progress.total += 1;
  }
  progress.done = progress.completed + progress.not_applicable;
  return progress;
}

// Complete when every question is done and every category is scored.
export function isAssessmentComplete(assessment: Assessment): boolean {
  return assessment.categoryIds.every(
    (id) => isCategoryFinished(assessment, id) && assessment.categoryResults[id],
  );
}

function updateCurrent(
  assessment: Assessment,
  questionId: QuestionId,
  transition: (thread: QuestionThread) => QuestionThread,
): Assessment {
  const thread = getThread(assessment, questionId);
  const current = currentQuestion(assessment, categoryOf(questionId));
  if (current !== questionId) {
    throw new AssessmentError(
      "not_current",
      `Question ${questionId} is not the current question (current: ${current ?? "none"})`,
    );
  }
  return setThread(assessment, transition(thread));
}

// Only called after getThread, so the question is known to exist.
function categoryOf(questionId: QuestionId): CategoryId {
  return getCategoryOfQuestion(questionId)!.id;
}

function setThread(assessment: Assessment, thread: QuestionThread): Assessment {
  return {
    ...assessment,
    threads: { ...assessment.threads, [thread.questionId]: thread },
  };
}
