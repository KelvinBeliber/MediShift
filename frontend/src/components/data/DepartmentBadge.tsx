import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Departments carry no colour of their own in the data model — adding one
 * would mean a schema change and a picker UI nobody asked for. Hashing the
 * id (falling back to name) into a fixed palette gives every department a
 * stable colour everywhere it appears without either, at the cost of new
 * departments only getting a colour once they exist.
 *
 * Deliberately outside the green/amber/red status vocabulary in `badge.tsx`
 * — this is an identity tag ("which department"), not a judgement ("how is
 * it doing"). Mixing the two would make status colour mean two different
 * things depending on which badge you're looking at.
 */
// 12 hues — enough that a hospital's usual department count (a dozen-ish)
// mostly gets a colour to itself instead of doubling up. Deliberately skips
// green/emerald/lime (= success), red (= destructive) and amber/yellow
// (= warning) so a department tag is never mistaken for a status.
const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-slate-200 text-slate-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-stone-200 text-stone-700',
]

function hashToIndex(key: string, length: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash % length
}

interface DepartmentBadgeProps {
  id?: string
  name: string
  className?: string
}

export function DepartmentBadge({ id, name, className }: DepartmentBadgeProps) {
  const colour = PALETTE[hashToIndex(id ?? name, PALETTE.length)]
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', colour, className)}>
      {name}
    </Badge>
  )
}
