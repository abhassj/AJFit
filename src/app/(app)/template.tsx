import { PageTransition } from '@/components/motion'

/**
 * A template rather than a layout: Next remounts templates on every navigation,
 * which is exactly what makes the page transition re-run per route. A layout
 * would mount once and never animate again.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
