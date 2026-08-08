import { env } from '@config/env';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { GenerateScheduleRequest, GenerateScheduleResponse } from './types';

export async function requestScheduleGeneration(payload: GenerateScheduleRequest): Promise<GenerateScheduleResponse> {
  let response: Response;

  try {
    response = await fetch(`${env.schedulingService.url}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.schedulingService.apiKey ? { 'X-API-Key': env.schedulingService.apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    logger.error('Scheduling service request failed', error);
    throw ApiError.internal(
      'Scheduling service is unreachable. Make sure the Python scheduling-service is running and SCHEDULING_SERVICE_URL is correct.'
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 401) {
      throw ApiError.internal('Scheduling service rejected the request — check SCHEDULING_SERVICE_API_KEY matches on both sides.');
    }
    throw ApiError.internal(`Scheduling service returned an error: ${detail || response.statusText}`);
  }

  return (await response.json()) as GenerateScheduleResponse;
}
