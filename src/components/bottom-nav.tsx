'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  ClipboardIcon,
  DumbbellIcon,
  HomeIcon,
  PlayIcon,
} from '@/components/icons'

const TABS = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/workouts', label: 'Workouts', Icon: DumbbellIcon },
  { href: '/program', label: 'Program', Icon: ClipboardIcon },
  { href: '/start', label: 'Start', Icon: PlayIcon },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline/80 bg-base/85 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="group relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-colors"
              >
                {/* Active indicator — the underline/highlight from the design doc. */}
                <span
                  className={`absolute top-0 h-px w-10 rounded-full transition-all duration-300 ${
                    active
                      ? 'bg-danger shadow-[0_0_12px_2px_var(--color-danger)]'
                      : 'bg-transparent'
                  }`}
                />
                <Icon
                  className={`h-[22px] w-[22px] transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-faint group-hover:text-secondary'
                  }`}
                />
                <span
                  className={`text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-faint group-hover:text-secondary'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
