import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import AIPrompt from './ai-prompt'
import { cn } from '@/lib/utils'

/**
 * Adapted from KokonutUI's `ai-input-search` (https://kokonutui.com/r/ai-input-search.json).
 *
 * The original is a standalone composer with a "Search the web" globe toggle, a
 * paperclip, and its own `ring-black/10` capsule — a second, differently-styled
 * text input. Shipping it beside `ai-prompt` would put two competing composers
 * on one screen, so this keeps the part that earns its place — the **first-run
 * surface**: a centred prompt with example questions, shown before a
 * conversation exists — and delegates the input itself to `AIPrompt` so there
 * is exactly one composer in the system, not two that drift apart.
 *
 * The globe toggle is gone with the web search it implied: this assistant reads
 * MediShift's own database and nothing else, and a control suggesting otherwise
 * would be a lie about what the answer is grounded in.
 *
 * Suggestions are questions the tool set can actually answer. They are not
 * decorative — a starter that returns "I don't have data for that" teaches the
 * user the feature is broken on their first try.
 */

interface AIInputSearchProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onPickSuggestion: (question: string) => void
  suggestions: string[]
  disabled?: boolean
  busy?: boolean
  maxLength?: number
  footnote?: React.ReactNode
  title: string
  description: string
  className?: string
}

export default function AIInputSearch({
  value,
  onChange,
  onSubmit,
  onPickSuggestion,
  suggestions,
  disabled = false,
  busy = false,
  maxLength,
  footnote,
  title,
  description,
  className,
}: AIInputSearchProps) {
  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      <div className="mb-7 text-center">
        <h2 className="text-xl leading-[1.3] font-semibold tracking-[-0.016em] text-foreground">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <AIPrompt
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        busy={busy}
        maxLength={maxLength}
        footnote={footnote}
        autoFocus
      />

      {suggestions.length > 0 && (
        <div className="mt-6">
          <p className="mb-2.5 text-[0.6875rem] leading-none font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Try asking
          </p>
          <ul className="flex flex-col gap-1.5">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => onPickSuggestion(suggestion)}
                  disabled={disabled || busy}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border border-transparent px-3 py-2.5 text-left',
                    'text-sm text-foreground transition-colors duration-150 motion-reduce:transition-none',
                    'hover:border-border hover:bg-secondary',
                    'focus-visible:ring-2 focus-visible:ring-brand-green-deep focus-visible:ring-offset-2 focus-visible:outline-none',
                    'disabled:cursor-not-allowed disabled:opacity-45',
                  )}
                >
                  <MagnifyingGlassIcon
                    className="size-4 shrink-0 text-brand-teal-deep"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
