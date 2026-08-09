import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'
import { assistantApi } from './api'
import type { AssistantTurn, ChatMessage } from './types'

/**
 * Questions the tool set can genuinely answer, phrased the way a manager would
 * ask them. A starter that returns "I don't have data for that" teaches someone
 * the feature is broken on their first try, so these map onto real tools:
 * overtime, staffing, attendance, leave, and certification expiry.
 */
export const HOSPITAL_SUGGESTIONS = [
  'Which department is most understaffed over the next two weeks?',
  'Who worked the most overtime this month?',
  'Whose certifications expire in the next 60 days?',
]

export const DEPARTMENT_SUGGESTIONS = [
  'Are we covered for the next two weeks?',
  'Who worked the most overtime this month?',
  'Who is on approved leave next week?',
]

let turnId = 0
function nextId(): string {
  turnId += 1
  return `turn-${turnId}`
}

/**
 * The conversation.
 *
 * State lives here rather than in a store because the backend is stateless —
 * there is no conversation collection, so a transcript has exactly the lifetime
 * of the screen. Leaving the route ends the conversation, which is honest about
 * what is actually persisted.
 */
export function useAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')

  /**
   * The transcript as the API wants it, kept in a ref so a rapid second send
   * cannot replay a stale `messages` closure. Only successful turns go in —
   * replaying an error bubble as an assistant turn would teach the model that
   * "The assistant is busy right now" was something it said.
   */
  const history = useRef<AssistantTurn[]>([])

  const capabilities = useQuery({
    queryKey: ['assistant', 'capabilities'],
    queryFn: assistantApi.capabilities,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: (question: string) => assistantApi.ask(question, history.current),
    onSuccess: (answer, question) => {
      history.current = [
        ...history.current,
        { role: 'user', content: question },
        { role: 'assistant', content: answer.answer },
      ]
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'assistant', content: answer.answer, toolCalls: answer.toolCalls },
      ])
    },
    onError: (error: unknown) => {
      // The backend writes specific, actionable copy ("You've reached the limit
      // of 20 assistant questions per hour…"). Surface it verbatim rather than
      // replacing it with a generic failure string.
      const message =
        error instanceof ApiError
          ? error.message
          : 'The assistant could not be reached. Check your connection and try again.'
      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'assistant', content: message, error: true },
      ])
    },
  })

  const send = useCallback(
    (raw?: string) => {
      const question = (raw ?? draft).trim()
      if (!question || mutation.isPending) return

      setMessages((current) => [...current, { id: nextId(), role: 'user', content: question }])
      setDraft('')
      mutation.mutate(question)
    },
    [draft, mutation],
  )

  const reset = useCallback(() => {
    history.current = []
    setMessages([])
    setDraft('')
    mutation.reset()
  }, [mutation])

  return {
    messages,
    draft,
    setDraft,
    send,
    reset,
    isPending: mutation.isPending,
    capabilities: capabilities.data,
    isLoadingCapabilities: capabilities.isLoading,
    capabilitiesError: capabilities.error,
  }
}
