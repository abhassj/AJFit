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

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />
      <path d="m13.5 7 3.5 3.5" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16" />
      <path d="M9.5 7V5h5v2" />
      <path d="M6.5 7 7.5 20h9L17.5 7" />
      <path d="M10.5 11v5" />
      <path d="M13.5 11v5" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </svg>
  )
}

export function SkipIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 6 6 18" />
      <path d="M10 12 19 6v12z" />
    </svg>
  )
}

export function RestIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z" />
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
