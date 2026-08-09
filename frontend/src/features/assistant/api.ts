import { get, post } from '@/lib/api/client'
import type { AssistantAnswer, AssistantCapabilities, AssistantTurn } from './types'

export const assistantApi = {
  capabilities: () => get<AssistantCapabilities>('/assistant/capabilities'),
  ask: (question: string, history: AssistantTurn[]) =>
    post<AssistantAnswer>('/assistant/ask', { question, history }),
}
