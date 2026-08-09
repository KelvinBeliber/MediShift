import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '@config/env';
import { ApiError } from '@utils/ApiError';
import {
  ASSISTANT_MAX_HISTORY_TURNS,
  ASSISTANT_MAX_TOOL_ROUNDS,
} from '@constants/assistant';
import { getAnthropicClient } from './anthropicClient';
import { AssistantScope, describeScope } from './scope';
import { ASSISTANT_TOOLS, runTool } from './tools';

/** One turn of the transcript, as the client stores and replays it. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** What the model actually did, surfaced to the UI so an answer can be traced to its data. */
export interface ToolTrace {
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
}

export interface AssistantAnswer {
  answer: string;
  toolCalls: ToolTrace[];
  scope: 'hospital' | 'department';
  departmentName?: string;
  model: string;
}

/**
 * Tool schemas are generated from the same zod objects the executors validate
 * against, so the shape the model is shown and the shape the query accepts
 * cannot drift apart.
 */
function toolDefinitions(): Anthropic.Tool[] {
  return ASSISTANT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.schema, { io: 'input' }) as Anthropic.Tool.InputSchema,
  }));
}

function systemPrompt(scope: AssistantScope): string {
  const today = new Date().toISOString().slice(0, 10);

  return [
    'You are the MediShift assistant. You answer a hospital manager\'s questions about their workforce — overtime, staffing levels, attendance, leave, and certification compliance — using only the tools provided.',
    '',
    `Today is ${today}. The caller's role is "${scope.roleName}" and their answers cover ${describeScope(scope)}.`,
    '',
    'How to work:',
    '- Call tools to get figures. Never estimate, extrapolate, or state a number you did not read from a tool result.',
    '- Department names must be resolved to ids with list_departments before use.',
    '- If a tool result carries a scopeNote, tell the user which department the figures are actually for.',
    '- If the data does not answer the question, say so plainly and name what is missing. A wrong number on a staffing question is worse than no number.',
    '',
    'How to answer:',
    '- Lead with the answer, then the supporting figures. Two or three short paragraphs at most.',
    '- Give dates as they appear in the data and always name the period a figure covers.',
    '- Plain prose, and plain means plain: no markdown of any kind. No headings, no tables, no **bold**, no _italics_, no backticks. The answer is rendered as literal text, so a stray asterisk shows up on screen as an asterisk.',
    '- Use a short list only when naming more than three people or shifts, one per line, no bullet characters.',
    '',
    'Shifts run morning 07:00–15:00, afternoon 15:00–23:00, night 23:00–07:00. Leave is approved in two stages: department, then HR.',
    '',
    'You have read-only access. You cannot create, edit, publish, approve, or delete anything — if asked to, say so and point the user at the relevant screen. Compensation and salary are out of scope for this feature and are not available to you.',
  ].join('\n');
}

/** Trims replayed history from the head, so a long session degrades rather than growing unbounded. */
function toMessages(history: AssistantTurn[], question: string): Anthropic.MessageParam[] {
  const recent = history.slice(-ASSISTANT_MAX_HISTORY_TURNS);
  const messages: Anthropic.MessageParam[] = recent
    .filter((turn) => turn.content.trim().length > 0)
    .map((turn) => ({ role: turn.role, content: turn.content }));

  // The API requires the conversation to start on a user turn.
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }

  messages.push({ role: 'user', content: question });
  return messages;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/**
 * The agentic loop.
 *
 * Written by hand rather than with the SDK's tool runner because the loop is
 * where the feature's guarantees live: every tool call is executed through
 * `runTool` with the server-resolved scope, the round count is capped so a
 * confused model cannot run up a bill, and the trace of what was called is
 * returned to the caller. None of that is the runner's job.
 */
export async function ask(
  question: string,
  history: AssistantTurn[],
  scope: AssistantScope
): Promise<AssistantAnswer> {
  const client = getAnthropicClient();
  const tools = toolDefinitions();
  const messages = toMessages(history, question);
  const toolCalls: ToolTrace[] = [];

  for (let round = 0; round <= ASSISTANT_MAX_TOOL_ROUNDS; round += 1) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: env.anthropic.model,
        max_tokens: env.anthropic.maxTokens,
        // Both of these are set explicitly rather than left to the default,
        // because the defaults differ by model and this one is configurable:
        //
        // - `thinking` omitted means *no thinking at all* on Sonnet 4.6, and
        //   adaptive on the Opus 5 family. Stated outright, the loop behaves the
        //   same whichever model ASSISTANT_MODEL names — and a question like
        //   "who worked the most overtime this month" needs the model to resolve
        //   a date range before it picks a tool, which is exactly the reasoning
        //   thinking buys.
        // - `medium` effort is the tool-heavy-workflow setting. `low` is tuned
        //   for chat and classification, and under-thinking here shows up as a
        //   wrong date range rather than a visibly worse answer. Note `xhigh`
        //   does not exist on Sonnet 4.6 — the ladder is low/medium/high/max.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium' },
        system: systemPrompt(scope),
        tools,
        messages,
      });
    } catch (error) {
      throw translateAnthropicError(error);
    }

    if (response.stop_reason === 'refusal') {
      throw new ApiError(422, 'The assistant declined to answer that question. Try rephrasing it.');
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUses.length === 0) {
      const answer = extractText(response.content);
      return {
        answer: answer || 'I could not put together an answer for that. Try asking it a different way.',
        toolCalls,
        scope: scope.mode,
        departmentName: scope.departmentName,
        model: response.model,
      };
    }

    // Parallel tool calls must all come back in one user message, or the model
    // learns to stop issuing them in parallel.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const { ok, result } = await runTool(use.name, use.input, scope);
      toolCalls.push({ tool: use.name, input: (use.input ?? {}) as Record<string, unknown>, ok });
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(result),
        is_error: !ok,
      });
    }

    messages.push({ role: 'user', content: results });
  }

  throw new ApiError(
    504,
    `The assistant kept looking for more data after ${ASSISTANT_MAX_TOOL_ROUNDS} rounds and was stopped. Try a narrower question — one department, one month.`
  );
}

/**
 * The Anthropic SDK's failures are not this API's failures. A 401 from
 * Anthropic is an operator problem, not a caller problem, so it must not be
 * relayed as a 401 to a user who is perfectly well authenticated.
 */
function translateAnthropicError(error: unknown): ApiError {
  const status = (error as { status?: number })?.status;

  if (status === 429) {
    return new ApiError(503, 'The assistant is busy right now. Try again in a moment.');
  }
  if (status === 401 || status === 403) {
    return new ApiError(503, 'The assistant could not authenticate with Anthropic. Check ANTHROPIC_API_KEY.');
  }
  if (typeof status === 'number' && status >= 500) {
    return new ApiError(503, 'The assistant is temporarily unavailable. Try again shortly.');
  }

  return ApiError.internal('The assistant could not complete that request.');
}
