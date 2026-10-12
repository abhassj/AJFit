import { redirect } from 'next/navigation'

import { OnboardingPage } from '@/components/onboarding-page'
import { pageTitle } from '@/lib/brand'
import { getLatestBodyweightKg, getProfile } from '@/lib/profile'
import { DEFAULT_UNITS } from '@/lib/units'

export const metadata = { title: pageTitle('Welcome') }
export const dynamic = 'force-dynamic'

/**
 * Where a new account lands after confirming its email: sign up → confirm →
 * here → Home. An account that has already finished it goes straight Home.
 */
export default async function Onboarding() {
  const [profile, weightKg] = await Promise.all([
    getProfile(),
    getLatestBodyweightKg(),
  ])
  if (profile?.onboarded_at) redirect('/')

  return (
    <OnboardingPage
      initial={{
        displayName: profile?.display_name ?? null,
        motto: profile?.motto ?? null,
        weightKg,
        heightCm: profile?.height_cm ?? null,
        weightUnit: profile?.weight_unit ?? DEFAULT_UNITS.weight,
        heightUnit: profile?.height_unit ?? DEFAULT_UNITS.height,
      }}
    />
  )
}
