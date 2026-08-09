import Anthropic from '@anthropic-ai/sdk';
import { env } from '@config/env';
import { ApiError } from '@utils/ApiError';

let client: Anthropic | null = null;
let stubbed = false;

/** Whether the feature is configured at all. Drives the 503 and the frontend's availability check. */
export function isAssistantConfigured(): boolean {
  return stubbed || Boolean(env.anthropic.apiKey);
}

/**
 * Lazily constructed so the server boots — and every other screen keeps
 * working — without an API key set. The key is only needed at the moment
 * someone actually asks a question.
 */
export function getAnthropicClient(): Anthropic {
  if (stubbed && client) return client;

  if (!env.anthropic.apiKey) {
    throw new ApiError(503, 'The AI Assistant is not configured on this server. Set ANTHROPIC_API_KEY to enable it.');
  }

  client ??= new Anthropic({ apiKey: env.anthropic.apiKey });
  return client;
}

/**
 * Test seam. The suite drives the whole controller → service → tool path with a
 * scripted model, which is the only way to assert that scoping and the salary
 * exclusion hold *through* the loop rather than only in the executors.
 */
export function __setAnthropicClientForTests(stub: Anthropic | null): void {
  client = stub;
  stubbed = stub !== null;
}
