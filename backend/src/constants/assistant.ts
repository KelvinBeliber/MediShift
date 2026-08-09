/**
 * Limits for the AI Assistant.
 *
 * This is the only feature in MediShift that costs money per request, so the
 * ceilings live here as named constants rather than as numbers buried in the
 * service — they are a budget decision, not an implementation detail.
 */

/** Requests per user per window. Keyed by user id, not IP — see assistant.routes.ts. */
export const ASSISTANT_RATE_LIMIT = 20;
export const ASSISTANT_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * How many times the model may come back asking for more tools before the loop
 * gives up. Each pass is a billed round trip, and no legitimate question about a
 * department's staffing has ever needed more than a handful.
 */
export const ASSISTANT_MAX_TOOL_ROUNDS = 6;

/**
 * How much prior conversation the client may replay. Older turns are dropped
 * from the head, so a long session degrades into a short-memory one rather than
 * into an unbounded bill.
 */
export const ASSISTANT_MAX_HISTORY_TURNS = 12;

/** Characters accepted in a single question. */
export const ASSISTANT_MAX_QUESTION_LENGTH = 1000;

/** Rows any single tool may return. Keeps a 4,000-employee hospital out of the context window. */
export const ASSISTANT_MAX_ROWS = 50;

/** How far ahead or back a tool call may look, in days. */
export const ASSISTANT_MAX_RANGE_DAYS = 366;
