import { redirect } from 'next/navigation'

import { HomeDashboard } from '@/components/home-dashboard'
import { getHomeData } from '@/lib/home'
import { getProfile } from '@/lib/profile'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Home · AJFit' }

// "Today" and the session log both move outside this render, so never cache.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const [data, profile] = await Promise.all([getHomeData(), getProfile()])

  return <HomeDashboard data={data} motto={profile?.motto ?? null} />
}
