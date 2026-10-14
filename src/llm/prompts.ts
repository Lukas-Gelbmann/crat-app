import type { Locale } from "@/i18n/config";
import type { Question } from "@/domain/types";
import type { Exchange } from "@/domain/thread";

const languageNames: Record<Locale, string> = { en: "English", de: "German" };

// Ported from the crat-demo completeness agent.
export function completenessSystemPrompt(locale: Locale): string {
  return `You are a cybersecurity compliance assessor checking whether an answer to a compliance question is complete enough to assess.

Consider:
- Does the answer directly address what was asked?
- Is there enough detail to understand the organization's actual practices?
- Are there obvious gaps or ambiguities that need clarification?

Be reasonable: do not demand excessive detail. Ask for a follow-up only when information that is essential for assessing the question is missing.

Respond with:
- decision: "complete" or "needs_follow_up"
- reasoning: a short explanation of your decision
- followUpQuestion: if needs_follow_up, one specific clarifying question about a single missing element, written in ${languageNames[locale]}; otherwise an empty string`;
}

// Ported from the crat-demo answer agent, including its 1–5 rubric.
export function scoringSystemPrompt(locale: Locale): string {
  return `You are a cybersecurity compliance analyst. Consolidate an interview about one compliance question into a final answer and score the organization's compliance.

Scoring scale:
1 - No controls or practices in place
2 - Ad-hoc or informal practices, major gaps
3 - Basic controls in place but inconsistent or incomplete
4 - Well-defined controls with minor gaps or improvement opportunities
5 - Mature, comprehensive controls with continuous improvement

Base your assessment only on the information provided. Do not assume controls that were not mentioned.

Respond with:
- finalAnswer: a concise, consolidated summary of the organization's answer
- notes: specific observations on strengths, gaps and recommended improvements
- score: an integer from 1 to 5

Write finalAnswer and notes in ${languageNames[locale]}.`;
}

export function completenessPrompt(
  question: Question,
  exchanges: Exchange[],
  locale: Locale,
  followUpsLeft: number,
): string {
  return `${questionHeader(question, locale)}

Interview so far:
${transcript(question, exchanges, locale)}

Follow-up questions left: ${followUpsLeft}`;
}

export function scoringPrompt(
  question: Question,
  exchanges: Exchange[],
  locale: Locale,
): string {
  return `${questionHeader(question, locale)}

Interview:
${transcript(question, exchanges, locale)}`;
}

function questionHeader(question: Question, locale: Locale): string {
  return `Compliance question: ${question.text[locale]}
What a good answer covers: ${question.context[locale]}`;
}

function transcript(
  question: Question,
  exchanges: Exchange[],
  locale: Locale,
): string {
  return exchanges
    .flatMap((exchange, index) => [
      exchange.prompt.kind === "catalog"
        ? `QUESTION: ${question.text[locale]}`
        : `FOLLOW-UP ${index}: ${exchange.prompt.text}`,
      exchange.answer ? `ANSWER: ${exchange.answer.text}` : "ANSWER: (none yet)",
    ])
    .join("\n");
}
