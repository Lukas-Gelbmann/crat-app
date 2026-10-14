import type { QuestionId, UserId } from "./types";

export const MAX_FOLLOW_UPS = 3;

export type Answer = { text: string; authorId: UserId };

// One question/answer round. The first prompt is the catalog question,
// later prompts are follow-ups generated during evaluation.
export type Exchange = {
  prompt: { kind: "catalog" } | { kind: "follow_up"; text: string };
  answer: Answer | null;
};

export type Evaluation =
  | { decision: "complete" }
  | { decision: "needs_follow_up"; followUpQuestion: string };

// "active" is the question currently discussed in its category's chat room.
// `pending` says what happens next: someone answers, or the answer is checked
// for completeness (LLM step). Scoring happens per category once all of its
// questions are done (see assessment.ts).
export type QuestionThread =
  | { status: "open"; questionId: QuestionId; exchanges: Exchange[] }
  | {
      status: "active";
      questionId: QuestionId;
      exchanges: Exchange[];
      pending: "answer" | "evaluation";
    }
  | {
      status: "skipped";
      questionId: QuestionId;
      exchanges: Exchange[];
      // Position in the skip queue; skipped questions come back in this order.
      skipOrder: number;
    }
  | {
      status: "not_applicable";
      questionId: QuestionId;
      exchanges: Exchange[];
      reason: string;
      decidedBy: UserId;
    }
  | { status: "completed"; questionId: QuestionId; exchanges: Exchange[] };

export type ThreadStatus = QuestionThread["status"];

type Active = Extract<QuestionThread, { status: "active" }>;

export class ThreadError extends Error {
  constructor(
    readonly code: "invalid_transition" | "empty_text",
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

// Makes the question the active one. Skipped threads resume where they left off.
export function activateThread(thread: QuestionThread): QuestionThread {
  if (thread.status !== "open" && thread.status !== "skipped") {
    throw invalid(thread, "activate");
  }
  const exchanges: Exchange[] =
    thread.exchanges.length > 0
      ? thread.exchanges
      : [{ prompt: { kind: "catalog" }, answer: null }];
  return {
    status: "active",
    questionId: thread.questionId,
    exchanges,
    pending: "answer",
  };
}

export function submitAnswer(
  thread: QuestionThread,
  userId: UserId,
  text: string,
): QuestionThread {
  const current = requirePending(thread, "answer", "submit an answer");
  const trimmed = requireText(text, "Answer");
  const exchanges = current.exchanges.map((exchange, index) =>
    index === current.exchanges.length - 1
      ? { ...exchange, answer: { text: trimmed, authorId: userId } }
      : exchange,
  );
  return { ...current, exchanges, pending: "evaluation" };
}

// Applies the completeness check: either asks a follow-up or completes the
// question. Follow-ups beyond MAX_FOLLOW_UPS are ignored so the interview always
// terminates, whatever the evaluator returns.
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
  return {
    status: "completed",
    questionId: current.questionId,
    exchanges: current.exchanges,
  };
}

// "Come back later": moves the question to the back of the skip queue and
// keeps the answers given so far.
export function skipThread(
  thread: QuestionThread,
  skipOrder: number,
): QuestionThread {
  if (thread.status === "active") {
    requirePending(thread, "answer", "skip");
  } else if (thread.status !== "open" && thread.status !== "skipped") {
    throw invalid(thread, "skip");
  }
  return {
    status: "skipped",
    questionId: thread.questionId,
    exchanges: thread.exchanges,
    skipOrder,
  };
}

export function markNotApplicable(
  thread: QuestionThread,
  userId: UserId,
  reason: string,
): QuestionThread {
  if (thread.status === "active") {
    requirePending(thread, "answer", "mark as not applicable");
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
  return createThread(thread.questionId);
}

function requirePending(
  thread: QuestionThread,
  pending: Active["pending"],
  action: string,
): Active {
  if (thread.status !== "active" || thread.pending !== pending) {
    throw invalid(thread, action);
  }
  return thread;
}

function requireText(text: string, label: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new ThreadError("empty_text", `${label} must not be empty`);
  return trimmed;
}

function invalid(thread: QuestionThread, action: string): ThreadError {
  const state =
    thread.status === "active"
      ? `active (pending ${thread.pending})`
      : thread.status;
  return new ThreadError(
    "invalid_transition",
    `Cannot ${action} question ${thread.questionId} while ${state}`,
  );
}
