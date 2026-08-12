'use client'

import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
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
  { href: '/program', label: 'Split', Icon: ClipboardIcon },
  { href: '/start', label: 'Start', Icon: PlayIcon },
] as const

export function BottomNav() {
  const pathname = usePathname()
  const { scrollY } = useScroll()
  const reduced = useReducedMotion()

  const scale = useTransform(scrollY, [0, 100], [1, 0.96])
  const y = useTransform(scrollY, [0, 100], [0, 4])

  return (
    <m.nav
      style={reduced ? { x: '-50%' } : { scale, y, x: '-50%' }}
      aria-label="Primary"
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm origin-bottom rounded-full border border-white/5 bg-[#1A1D24]/80 shadow-2xl backdrop-blur-xl"
    >
      <ul className="mx-auto flex items-stretch px-2 py-1">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="group relative flex flex-col items-center gap-1 px-2 py-2 transition-colors"
              >
                {/* Active indicator — a subtle glowing background layer. */}
                <span
                  className={`absolute inset-0 rounded-full transition-all duration-300 ${
                    active
                      ? 'bg-white/5 shadow-[0_0_12px_2px_rgba(255,255,255,0.03)]'
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
    </m.nav>
  )
}
