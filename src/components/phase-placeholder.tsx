import { ClipboardIcon, PlayIcon } from '@/components/icons'

const ICONS = { clipboard: ClipboardIcon, play: PlayIcon }

/**
 * Stub for a tab whose page has not been built yet. Exists so the bottom
 * navigation has a real destination for all four tabs; replaced by the real
 * page in its own phase.
 */
export function PhasePlaceholder({
  title,
  phase,
  description,
  icon,
}: {
  title: string
  phase: string
  description: string
  icon: keyof typeof ICONS
}) {
  const Icon = ICONS[icon]

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="surface flex h-16 w-16 items-center justify-center rounded-2xl">
        <Icon className="h-7 w-7 text-faint" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          {title}
        </h1>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-secondary">
          {description}
        </p>
      </div>

      <span className="surface rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
        {phase}
      </span>
    </main>
  )
}
