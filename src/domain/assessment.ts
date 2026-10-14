import { catalog, getCategoryOfQuestion } from "./catalog";
import {
  activateThread,
  applyEvaluation,
  completeThread,
  createThread,
  markNotApplicable,
  reopenThread,
  skipThread,
  submitAnswer,
  type Evaluation,
  type QuestionThread,
  type ThreadResult,
  type ThreadStatus,
} from "./thread";
import type { CategoryId, QuestionId, UserId } from "./types";

// Each category is one shared chat room: everyone responsible for it works
// through its questions strictly in order, one current question at a time.
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
    readonly code:
      | "unknown_category"
      | "no_categories"
      | "unknown_question"
      | "not_current",
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

export function completeQuestion(
  assessment: Assessment,
  questionId: QuestionId,
  result: ThreadResult,
): Assessment {
  return updateCurrent(assessment, questionId, (thread) =>
    completeThread(thread, result),
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

// Reopening works on any finished question; it rejoins the queue as open.
export function reopenQuestion(
  assessment: Assessment,
  questionId: QuestionId,
): Assessment {
  return setThread(assessment, reopenThread(getThread(assessment, questionId)));
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

export function isAssessmentComplete(assessment: Assessment): boolean {
  const progress = getProgress(assessment);
  return progress.done === progress.total;
}

function updateCurrent(
  assessment: Assessment,
  questionId: QuestionId,
  transition: (thread: QuestionThread) => QuestionThread,
): Assessment {
  const thread = getThread(assessment, questionId);
  const categoryId = getCategoryOfQuestion(questionId)!.id;
  const current = currentQuestion(assessment, categoryId);
  if (current !== questionId) {
    throw new AssessmentError(
      "not_current",
      `Question ${questionId} is not the current question (current: ${current ?? "none"})`,
    );
  }
  return setThread(assessment, transition(thread));
}

function setThread(assessment: Assessment, thread: QuestionThread): Assessment {
  return {
    ...assessment,
    threads: { ...assessment.threads, [thread.questionId]: thread },
  };
}
