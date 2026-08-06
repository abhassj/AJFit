/**
 * One consistent icon set for the whole app — the design doc calls for picking
 * a single library and not mixing styles. These are hand-rolled so there is no
 * runtime dependency and every glyph shares the same 24px grid, 1.75 stroke
 * width, round caps and joins.
 */

type IconProps = {
  className?: string
}

function base(className?: string) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  )
}

export function DumbbellIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 9v6" />
      <path d="M6 6.5v11" />
      <path d="M18 6.5v11" />
      <path d="M21 9v6" />
      <path d="M6 12h12" />
    </svg>
  )
}

export function ClipboardIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h2" />
      <path d="M9.5 12h5" />
      <path d="M9.5 16h5" />
    </svg>
  )
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 4.5 19.5 12 7 19.5z" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </svg>
  )
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  )
}

export function TargetIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  )
}

export function SwapIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 8h13l-3.5-3.5" />
      <path d="M20 16H7l3.5 3.5" />
    </svg>
  )
}
