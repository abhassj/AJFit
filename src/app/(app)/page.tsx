import { HomeDashboard } from '@/components/home-dashboard'
import { getHomeData } from '@/lib/home'
import { getProfile } from '@/lib/profile'

export const metadata = { title: 'Home · AJFit' }

// "Today" and the session log both move outside this render, so never cache.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // No explicit auth check here any more: getHomeData() goes through
  // requireUser(), which redirects an expired session to /sign-in rather than
  // throwing. Repeating the check here only duplicated the same getUser() call.
  const [data, profile] = await Promise.all([getHomeData(), getProfile()])

  return <HomeDashboard data={data} motto={profile?.motto ?? null} />
}
