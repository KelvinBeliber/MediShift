import { useEffect } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { cn } from '@/lib/utils'

/**
 * Adapted from KokonutUI's `ai-prompt` (https://kokonutui.com/r/ai-prompt.json).
 *
 * The original is a demo composer: a `bg-black/5` capsule with a model picker
 * (OpenAI and Gemini logos inlined as SVG), a paperclip that opens a file input
 * nothing reads, a "is free this weekend! / Ship Now!" marketing header, and a
 * blue focus ring. Almost none of that survives contact with this app, and the
 * parts that were cut were cut for reasons rather than taste:
 *
 * - **The model picker is gone.** The model is an operator decision made in
 *   `ANTHROPIC_MODEL`, not something a ward manager chooses mid-question, and a
 *   third-party vendor logo has no place in MediShift's chrome.
 * - **The attachment control is gone.** `POST /assistant/ask` takes a question
 *   and a transcript. A control that cannot do anything is worse than no
 *   control — DESIGN.md's "hide, rather than disable".
 * - **`bg-black/5` and the blue ring become real tokens** — white ground, 1px
 *   `Hairline`, and the `brand-teal-deep` focus stroke every other input in the
 *   system uses.
 * - **The send button is the primary button**: `brand-green` fill with navy
 *   text, 4px radius, per the Two-Green Rule. Not `bg-black/5`.
 *
 * What survives is the useful part: the auto-resizing textarea, Enter-to-send
 * with Shift+Enter for a newline, and the composer-as-one-surface layout.
 */

interface AIPromptProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  busy?: boolean
  maxLength?: number
  /** Rendered at the foot of the composer — used for the scope line. */
  footnote?: React.ReactNode
  autoFocus?: boolean
  className?: string
}

export default function AIPrompt({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask about overtime, staffing, attendance, leave, or certifications…',
  disabled = false,
  busy = false,
  maxLength,
  footnote,
  autoFocus = false,
  className,
}: AIPromptProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 56, maxHeight: 200 })

  // The parent clears `value` after a successful send; the textarea has to
  // collapse with it or it keeps the height of the question just asked.
  useEffect(() => {
    if (value === '') adjustHeight(true)
  }, [value, adjustHeight])

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus, textareaRef])

  const canSend = value.trim().length > 0 && !disabled && !busy
  const remaining = maxLength ? maxLength - value.length : undefined

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-[var(--shadow-card)]',
        'transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none',
        'focus-within:border-brand-teal-deep',
        className,
      )}
    >
      <label htmlFor="assistant-question" className="sr-only">
        Ask the assistant a question
      </label>
      <textarea
        id="assistant-question"
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(maxLength ? event.target.value.slice(0, maxLength) : event.target.value)
          adjustHeight()
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        maxLength={maxLength}
        className={cn(
          'block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3.5 pb-1',
          'text-[0.9375rem] leading-relaxed text-foreground placeholder:text-muted-foreground',
          'outline-none disabled:cursor-not-allowed disabled:opacity-45',
        )}
      />

      <div className="flex items-end justify-between gap-3 px-3 pt-1 pb-3">
        <p className="min-w-0 flex-1 pb-1 pl-1 text-xs leading-snug text-muted-foreground">
          {footnote}
        </p>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Only once it's close enough to matter — a counter that is always
              visible reads as a limit the user is being pushed toward. */}
          {remaining !== undefined && remaining <= 120 && (
            <span
              className={cn(
                'text-xs tabular-nums',
                remaining <= 0 ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {remaining}
            </span>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            aria-label={busy ? 'Waiting for an answer' : 'Send question'}
            aria-busy={busy}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-sm',
              'bg-brand-green text-brand-navy transition-colors duration-150 motion-reduce:transition-none',
              'hover:bg-brand-green-press',
              'focus-visible:ring-2 focus-visible:ring-brand-green-deep focus-visible:ring-offset-2 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-brand-green',
            )}
          >
            {busy ? (
              <span
                className="size-4 animate-spin rounded-full border-2 border-brand-navy/25 border-t-brand-navy motion-reduce:animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <PaperAirplaneIcon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
