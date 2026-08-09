import { motion } from 'motion/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { panelVariants } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { toolLabel } from './toolLabels'
import type { ChatMessage } from './types'

/**
 * Strip markdown emphasis the answer isn't supposed to contain.
 *
 * The system prompt asks for plain prose and says so explicitly, but models
 * reach for `**bold**` on figures by habit — observed live on the very first
 * question this screen was tested with, rendering as literal asterisks.
 *
 * Stripping rather than rendering: this removes the markers and keeps the text,
 * so nothing model-authored is ever interpreted as markup. Deliberately narrow —
 * paired `**`/`__` around non-space content only, so prose that happens to
 * contain an asterisk survives untouched.
 */
function stripEmphasisMarkers(text: string): string {
  return text.replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
}

/**
 * One turn.
 *
 * The user's turn is a tinted bubble aligned right; the assistant's is plain
 * prose on the page ground with no bubble at all. That asymmetry is deliberate
 * — the answer is the content of this screen, and wrapping it in a container
 * would make it look like a quoted aside rather than the thing the user came
 * for. It also means a long answer sets at full measure instead of inside a
 * bubble that fights it.
 *
 * The entrance is the system's one entrance — 8px up over 220ms, once. A turn
 * arriving is a surface arriving, which is the amendment DESIGN.md's Motion
 * section already permits; nothing inside it animates.
 */
export function AssistantMessage({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        className="flex justify-end"
      >
        <p className="max-w-[85%] rounded-xl rounded-br-sm bg-secondary px-4 py-2.5 text-[0.9375rem] leading-relaxed break-words text-foreground sm:max-w-[75%]">
          {message.content}
        </p>
      </motion.div>
    )
  }

  if (message.error) {
    return (
      <motion.div
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        role="alert"
        className="flex max-w-[75ch] items-start gap-2.5 rounded-md bg-[#FDF2F1] px-3.5 py-3 text-[0.9375rem] leading-relaxed text-danger"
      >
        <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{message.content}</span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={panelVariants} initial="hidden" animate="visible" className="max-w-[75ch]">
      {/* `whitespace-pre-line` rather than a markdown renderer: the system
          prompt asks for plain prose, so honouring the model's paragraph breaks
          is the whole requirement. Rendering untrusted model output as markdown
          would also mean rendering whatever it decided to emit. */}
      <div className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-foreground">
        {stripEmphasisMarkers(message.content)}
      </div>

      {message.toolCalls && message.toolCalls.length > 0 && <ToolTrace calls={message.toolCalls} />}
    </motion.div>
  )
}

/**
 * What the answer was actually read from.
 *
 * This is the feature's receipt. An assistant that says "Cardiology is short
 * three people" is only worth trusting if you can see it looked at staffing
 * levels to say so — and a call that failed is shown as failed rather than
 * hidden, because an answer built on a failed lookup is exactly the one a
 * manager needs to distrust.
 */
function ToolTrace({ calls }: { calls: NonNullable<ChatMessage['toolCalls']> }) {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {calls.map((call, index) => (
        <li
          key={`${call.tool}-${index}`}
          className={cn(
            'inline-flex items-center gap-1.5 text-[0.6875rem] leading-none font-medium tracking-[0.02em]',
            call.ok ? 'text-muted-foreground' : 'text-danger',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              call.ok ? 'bg-brand-teal-deep' : 'bg-danger',
            )}
            aria-hidden="true"
          />
          {toolLabel(call.tool)}
          {!call.ok && ' — failed'}
        </li>
      ))}
    </ul>
  )
}
