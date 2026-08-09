import { z } from 'zod';
import { ASSISTANT_MAX_HISTORY_TURNS, ASSISTANT_MAX_QUESTION_LENGTH } from '@constants/assistant';

const turnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(ASSISTANT_MAX_QUESTION_LENGTH * 8),
});

export const askAssistantSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Ask a question first')
    .max(ASSISTANT_MAX_QUESTION_LENGTH, `Questions are capped at ${ASSISTANT_MAX_QUESTION_LENGTH} characters`),
  /**
   * The transcript is client-held and replayed — there is no conversation
   * collection. That keeps a per-request-cost feature from also accruing
   * storage, and it means the cap here is the only thing standing between a
   * long session and an unbounded prompt. The service trims to the last
   * `ASSISTANT_MAX_HISTORY_TURNS` again on its own.
   */
  history: z.array(turnSchema).max(ASSISTANT_MAX_HISTORY_TURNS * 2).optional().default([]),
});
