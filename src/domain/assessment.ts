import { catalog } from "./catalog";
import { createThread, type QuestionThread, type ThreadStatus } from "./thread";
import type { CategoryId, QuestionId, UserId } from "./types";

export type Assessment = {
  id: string;
  organizationId: string;
  // Selected categories, in catalog order.
  categoryIds: CategoryId[];
  threads: Record<QuestionId, QuestionThread>;
};

export type Progress = Record<ThreadStatus, number> & {
  total: number;
  // Completed or not applicable.
  done: number;
};

export class AssessmentError extends Error {
  constructor(
    readonly code: "unknown_category" | "no_categories" | "unknown_question",
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

// Applies a thread transition, e.g. updateThread(a, id, (t) => startThread(t, user)).
export function updateThread(
  assessment: Assessment,
  questionId: QuestionId,
  transition: (thread: QuestionThread) => QuestionThread,
): Assessment {
  const thread = transition(getThread(assessment, questionId));
  return {
    ...assessment,
    threads: { ...assessment.threads, [questionId]: thread },
  };
}

export function getProgress(
  assessment: Assessment,
  categoryIds?: readonly CategoryId[],
): Progress {
  const progress: Progress = {
    open: 0,
    answering: 0,
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

export function isAssessmentComplete(assessment: Assessment): boolean {
  const progress = getProgress(assessment);
  return progress.done === progress.total;
}

// The question a user should work on next within their responsible categories:
// a thread they are already answering, then open questions, then skipped ones.
// Threads locked by other users are never suggested.
export function nextQuestionFor(
  assessment: Assessment,
  userId: UserId,
  responsibleCategoryIds: readonly CategoryId[],
): QuestionId | undefined {
  const threads = questionIds(assessment, responsibleCategoryIds).map((id) =>
    getThread(assessment, id),
  );
  return (
    threads.find((t) => t.status === "answering" && t.assigneeId === userId) ??
    threads.find((t) => t.status === "open") ??
    threads.find((t) => t.status === "skipped")
  )?.questionId;
}
