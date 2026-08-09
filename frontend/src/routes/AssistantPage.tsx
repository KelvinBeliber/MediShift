import { useEffect, useRef } from 'react'
import { ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import AIInputSearch from '@/components/kokonutui/ai-input-search'
import AILoading from '@/components/kokonutui/ai-loading'
import AIPrompt from '@/components/kokonutui/ai-prompt'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel } from '@/components/dashboard-primitives/Panel'
import { Button } from '@/components/ui/button'
import { AssistantMessage } from '@/features/assistant/AssistantMessage'
import {
  DEPARTMENT_SUGGESTIONS,
  HOSPITAL_SUGGESTIONS,
  useAssistant,
} from '@/features/assistant/useAssistant'

/** Matches ASSISTANT_MAX_QUESTION_LENGTH in backend/src/constants/assistant.ts. */
const MAX_QUESTION_LENGTH = 1000

export function AssistantPage() {
  const { messages, draft, setDraft, send, reset, isPending, capabilities } = useAssistant()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Follow the conversation as it grows. `scroll-smooth` (a CSS class on the
  // scroll container itself) is the one place motion is worth it here — a hard
  // jump loses the reader's place mid-answer.
  //
  // Sets `scrollTop` on the message list directly rather than calling
  // `scrollIntoView` on a trailing sentinel: this screen nests two scroll
  // containers (the app shell's `<main>` and this screen's own message list),
  // and `scrollIntoView` walks up to the nearest scrollable ancestor it judges
  // needs moving — with two candidates it can settle on the wrong one, or move
  // the right one only partway, leaving the tail of the latest answer (the
  // tool-trace row) clipped below the fold. Setting `scrollTop` targets the
  // message list unambiguously.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, isPending])

  const isDepartmentScoped = capabilities?.scope === 'department'
  const unavailable = capabilities !== undefined && !capabilities.available

  // Held back until the scope is known, for the same reason as the footnote: a
  // Department Head should never be offered "which department is most
  // understaffed", which is not a question their scope can answer.
  const suggestions = !capabilities
    ? []
    : isDepartmentScoped
      ? DEPARTMENT_SUGGESTIONS
      : HOSPITAL_SUGGESTIONS

  /**
   * The scope line waits for the server rather than guessing.
   *
   * Defaulting to "every department" while the request is in flight would tell
   * a Department Head something false about what they are about to read, and
   * then quietly correct itself — worse than saying nothing for a moment.
   * Salary is the one claim that holds before any response, because it is true
   * of the feature rather than of this user.
   */
  const footnote = capabilities ? (
    <>
      {isDepartmentScoped
        ? `Answers cover ${capabilities.departmentName ?? 'your department'} only.`
        : 'Answers cover every department.'}{' '}
      Salary is never included. {capabilities.rateLimit.limit} questions an hour.
    </>
  ) : (
    'Salary is never included.'
  )

  const hasConversation = messages.length > 0

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Assistant"
        description="Ask about your workforce in plain language. Answers are read from MediShift's own records — nothing is changed."
        actions={
          hasConversation ? (
            <Button variant="ghost" onClick={reset} disabled={isPending}>
              <ArrowPathIcon className="size-4" aria-hidden="true" />
              New conversation
            </Button>
          ) : undefined
        }
      />

      {unavailable ? (
        <Panel elevation="resting" className="max-w-2xl p-6" role="alert">
          <div className="flex items-start gap-3">
            <LockClosedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h2 className="text-lg leading-[1.35] font-semibold tracking-[-0.012em]">
                The assistant is not configured
              </h2>
              {/* Names the wall, then says what still works — the alternative
                  is a screen that invites a question it cannot answer. */}
              <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
                This server has no Anthropic API key set, so questions cannot be answered. An
                administrator needs to set <code className="text-foreground">ANTHROPIC_API_KEY</code>{' '}
                and restart the backend. Reports and Analytics work without it.
              </p>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {hasConversation ? (
            <>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth pb-6">
                <div className="flex flex-col gap-6">
                  {messages.map((message) => (
                    <AssistantMessage key={message.id} message={message} />
                  ))}
                  {isPending && <AILoading />}
                </div>
              </div>

              {/* Docked composer. `sticky` rather than `fixed` so it sits inside
                  the app shell's single scrollport instead of over it. Full
                  width rather than a narrower `max-w-*`, so its edges line up
                  with the message column above instead of floating as a
                  narrower box off to one side. */}
              <div className="sticky bottom-0 shrink-0 bg-background pt-2 pb-1">
                <AIPrompt
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => send()}
                  busy={isPending}
                  maxLength={MAX_QUESTION_LENGTH}
                  footnote={footnote}
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto pt-4 sm:pt-10">
              <AIInputSearch
                value={draft}
                onChange={setDraft}
                onSubmit={() => send()}
                onPickSuggestion={(question) => send(question)}
                suggestions={suggestions}
                busy={isPending}
                maxLength={MAX_QUESTION_LENGTH}
                footnote={footnote}
                title="What would you like to know?"
                description={
                  isDepartmentScoped
                    ? `Ask about overtime, staffing, attendance, leave, or certifications in ${capabilities?.departmentName ?? 'your department'}.`
                    : 'Ask about overtime, staffing, attendance, leave, or certifications across the hospital.'
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
