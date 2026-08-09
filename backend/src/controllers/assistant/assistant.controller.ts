import { Request, Response } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { sendSuccess } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';
import * as assistantService from '@services/assistant/assistant.service';
import { isAssistantConfigured } from '@services/assistant/anthropicClient';
import { resolveScope } from '@services/assistant/scope';
import { ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS } from '@constants/assistant';

/**
 * What the caller may ask about, and whether the feature is switched on at all.
 *
 * The frontend calls this on mount so it can render an honest empty state — an
 * unconfigured server says so instead of letting someone type a question and
 * then fail. It is deliberately cheap: no model call, no cost.
 */
export const getCapabilities = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');

  const scope = await resolveScope(req.user);

  sendSuccess(res, 200, 'Assistant capabilities retrieved', {
    available: isAssistantConfigured(),
    scope: scope.mode,
    departmentName: scope.departmentName,
    rateLimit: { limit: ASSISTANT_RATE_LIMIT, windowMinutes: ASSISTANT_RATE_WINDOW_MS / 60000 },
  });
});

export const ask = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');

  const { question, history } = req.body as {
    question: string;
    history: assistantService.AssistantTurn[];
  };

  // Scope is resolved from the authenticated user on every request, never from
  // the body, and it is resolved *before* the model is invoked.
  const scope = await resolveScope(req.user);
  const answer = await assistantService.ask(question, history ?? [], scope);

  sendSuccess(res, 200, 'Answer generated', answer);
});
