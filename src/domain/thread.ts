import type { QuestionId, Score, UserId } from "./types";

export const MAX_FOLLOW_UPS = 3;

export type Answer = { text: string; authorId: UserId };

// One question/answer round. The first prompt is the catalog question,
// later prompts are follow-ups generated during evaluation.
export type Exchange = {
  prompt: { kind: "catalog" } | { kind: "follow_up"; text: string };
  answer: Answer | null;
};

export type ThreadResult = {
  finalAnswer: string;
  notes: string;
  score: Score;
};

export type Evaluation =
  | { decision: "complete" }
  | { decision: "needs_follow_up"; followUpQuestion: string };

// "answering" locks the thread to one assignee. `pending` says what happens next:
// the assignee answers, or the answer is evaluated / finalized (LLM steps).
export type QuestionThread =
  | { status: "open"; questionId: QuestionId; exchanges: Exchange[] }
  | {
      status: "answering";
      questionId: QuestionId;
      exchanges: Exchange[];
      assigneeId: UserId;
      pending: "answer" | "evaluation" | "finalization";
    }
  | { status: "skipped"; questionId: QuestionId; exchanges: Exchange[] }
  | {
      status: "not_applicable";
      questionId: QuestionId;
      exchanges: Exchange[];
      reason: string;
      decidedBy: UserId;
    }
  | {
      status: "completed";
      questionId: QuestionId;
      exchanges: Exchange[];
      result: ThreadResult;
      completedBy: UserId;
    };

export type ThreadStatus = QuestionThread["status"];

type Answering = Extract<QuestionThread, { status: "answering" }>;

export class ThreadError extends Error {
  constructor(
    readonly code:
      | "invalid_transition"
      | "not_assignee"
      | "empty_text",
    message: string,
  ) {
    super(message);
    this.name = "ThreadError";
  }
}

export function createThread(questionId: QuestionId): QuestionThread {
  return { status: "open", questionId, exchanges: [] };
}

export function followUpCount(thread: QuestionThread): number {
  return thread.exchanges.filter((e) => e.prompt.kind === "follow_up").length;
}

// Locks the thread for `userId`. Skipped threads resume where they left off.
export function startThread(
  thread: QuestionThread,
  userId: UserId,
): QuestionThread {
  if (thread.status !== "open" && thread.status !== "skipped") {
    throw invalid(thread, "start");
  }
  const exchanges: Exchange[] =
    thread.exchanges.length > 0
      ? thread.exchanges
      : [{ prompt: { kind: "catalog" }, answer: null }];
  return {
    status: "answering",
    questionId: thread.questionId,
    exchanges,
    assigneeId: userId,
    pending: "answer",
  };
}

export function submitAnswer(
  thread: QuestionThread,
  userId: UserId,
  text: string,
): QuestionThread {
  const current = requireAnswering(thread, userId, "answer", "submit an answer");
  const trimmed = requireText(text, "Answer");
  const exchanges = current.exchanges.map((exchange, index) =>
    index === current.exchanges.length - 1
      ? { ...exchange, answer: { text: trimmed, authorId: userId } }
      : exchange,
  );
  return { ...current, exchanges, pending: "evaluation" };
}

// Applies the completeness check. Follow-ups beyond MAX_FOLLOW_UPS are ignored
// so the interview always terminates, whatever the evaluator returns.
export function applyEvaluation(
  thread: QuestionThread,
  evaluation: Evaluation,
): QuestionThread {
  const current = requirePending(thread, "evaluation", "apply an evaluation");
  if (
    evaluation.decision === "needs_follow_up" &&
    followUpCount(current) < MAX_FOLLOW_UPS
  ) {
    const text = requireText(evaluation.followUpQuestion, "Follow-up question");
    return {
      ...current,
      exchanges: [
        ...current.exchanges,
        { prompt: { kind: "follow_up", text }, answer: null },
      ],
      pending: "answer",
    };
  }
  return { ...current, pending: "finalization" };
}

export function completeThread(
  thread: QuestionThread,
  result: ThreadResult,
): QuestionThread {
  const current = requirePending(thread, "finalization", "complete");
  return {
    status: "completed",
    questionId: current.questionId,
    exchanges: current.exchanges,
    result: { ...result, finalAnswer: result.finalAnswer.trim() },
    completedBy: current.assigneeId,
  };
}

// "Come back later": releases the lock and keeps the answers given so far.
export function skipThread(
  thread: QuestionThread,
  userId: UserId,
): QuestionThread {
  if (thread.status === "open") {
    return { status: "skipped", questionId: thread.questionId, exchanges: [] };
  }
  const current = requireAnswering(thread, userId, "answer", "skip");
  return {
    status: "skipped",
    questionId: current.questionId,
    exchanges: current.exchanges,
  };
}

export function markNotApplicable(
  thread: QuestionThread,
  userId: UserId,
  reason: string,
): QuestionThread {
  if (thread.status === "answering") {
    requireAnswering(thread, userId, "answer", "mark as not applicable");
  } else if (thread.status !== "open" && thread.status !== "skipped") {
    throw invalid(thread, "mark as not applicable");
  }
  return {
    status: "not_applicable",
    questionId: thread.questionId,
    exchanges: thread.exchanges,
    reason: requireText(reason, "Reason"),
    decidedBy: userId,
  };
}

// Reopens a finished thread for corrections. The question starts over;
// keeping an audit trail of earlier answers is the persistence layer's job.
export function reopenThread(thread: QuestionThread): QuestionThread {
  if (thread.status !== "completed" && thread.status !== "not_applicable") {
    throw invalid(thread, "reopen");
  }
  return { status: "open", questionId: thread.questionId, exchanges: [] };
}

function requirePending(
  thread: QuestionThread,
  pending: Answering["pending"],
  action: string,
): Answering {
  if (thread.status !== "answering" || thread.pending !== pending) {
    throw invalid(thread, action);
  }
  return thread;
}

function requireAnswering(
  thread: QuestionThread,
  userId: UserId,
  pending: Answering["pending"],
  action: string,
): Answering {
  const current = requirePending(thread, pending, action);
  if (current.assigneeId !== userId) {
    throw new ThreadError(
      "not_assignee",
      `Question ${thread.questionId} is being answered by another user`,
    );
  }
  return current;
}

function requireText(text: string, label: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new ThreadError("empty_text", `${label} must not be empty`);
  return trimmed;
}

function invalid(thread: QuestionThread, action: string): ThreadError {
  const state =
    thread.status === "answering"
      ? `answering (pending ${thread.pending})`
      : thread.status;
  return new ThreadError(
    "invalid_transition",
    `Cannot ${action} question ${thread.questionId} while ${state}`,
  );
}
