import { signOut } from '@/app/auth/actions'
import { ProfileForm } from '@/components/profile-form'
import { getProfilePageData } from '@/lib/profile'

export const metadata = { title: 'Profile · AJFit' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const data = await getProfilePageData()

  return (
    <main className="px-4 pt-2">
      <header className="px-1 pb-5">
        <p className="label-caps">Your Account</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          Profile
        </h1>
      </header>

      <ProfileForm data={data} />

      <form action={signOut} className="mt-5">
        <button
          type="submit"
          className="surface min-h-[48px] w-full rounded-xl text-sm font-semibold text-secondary transition-colors hover:text-primary"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
