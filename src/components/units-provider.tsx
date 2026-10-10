'use client'

import { createContext, useContext } from 'react'

import { DEFAULT_UNITS, type Units } from '@/lib/units'

const UnitsContext = createContext<Units>(DEFAULT_UNITS)

/**
 * The viewer's kg/lbs and cm/ft preference, for Client Components.
 *
 * Fed from the profile the (app) layout already loads, so it costs no extra
 * query. Server Components use getViewerUnits() from @/lib/profile instead.
 */
export function UnitsProvider({
  units,
  children,
}: {
  units: Units
  children: React.ReactNode
}) {
  return <UnitsContext value={units}>{children}</UnitsContext>
}

export function useUnits(): Units {
  return useContext(UnitsContext)
}
