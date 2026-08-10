import { signIn } from '@/app/auth/actions'
import { AuthForm } from '@/app/auth/auth-form'
import { AuthBackground } from '@/components/auth-background'

export const metadata = { title: 'Sign in · AJFit' }

export default function SignInPage() {
  return (
    <>
      <AuthBackground />
      <AuthForm
        title="Welcome back"
        subtitle="Pick up where you left off."
        submitLabel="Sign in"
        action={signIn}
        passwordAutoComplete="current-password"
        footer={{
          text: 'No account yet?',
          linkLabel: 'Sign up',
          href: '/sign-up',
        }}
      />
    </>
  )
}
