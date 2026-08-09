/** A tool the assistant called to answer a question, surfaced so an answer can be traced to its data. */
export interface ToolTrace {
  tool: string
  input: Record<string, unknown>
  ok: boolean
}

export interface AssistantAnswer {
  answer: string
  toolCalls: ToolTrace[]
  scope: 'hospital' | 'department'
  departmentName?: string
  model: string
}

export interface AssistantCapabilities {
  /** False when the server has no ANTHROPIC_API_KEY — the screen says so rather than failing on send. */
  available: boolean
  scope: 'hospital' | 'department'
  departmentName?: string
  rateLimit: { limit: number; windowMinutes: number }
}

/** One turn of the transcript. The backend is stateless; the client replays this. */
export interface AssistantTurn {
  role: 'user' | 'assistant'
  content: string
}

/** A rendered turn. `id` is client-side only — the backend stores nothing. */
export interface ChatMessage extends AssistantTurn {
  id: string
  toolCalls?: ToolTrace[]
  /** Set when the turn failed, so the bubble can render the backend's own error copy. */
  error?: boolean
}
