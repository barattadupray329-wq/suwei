import type { RentalCompletion } from '@/lib/rental-completion'

export function RentalCompletionStamp({ completion, compact = false }: {
  completion: RentalCompletion | null
  compact?: boolean
}) {
  if (!completion) return null

  return (
    <span
      aria-label={`${completion.label}：${completion.detail}`}
      title={completion.detail}
      className={`inline-flex -rotate-6 flex-col items-center rounded border-2 border-destructive font-bold leading-none text-destructive ${compact ? 'gap-0.5 px-2 py-1 text-[11px]' : 'gap-1 px-3 py-1.5 text-xs'}`}
    >
      <span className="tracking-widest">{completion.label}</span>
      {completion.kind === 'mixed' ? (
        <span className="border-t border-destructive/50 pt-1 text-[10px] font-semibold tracking-normal">
          {completion.detail}
        </span>
      ) : null}
    </span>
  )
}
