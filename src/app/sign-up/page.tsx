import { pageTitle } from '@/lib/brand'
import { signUp } from '@/app/auth/actions'
import { AuthForm } from '@/app/auth/auth-form'
import { AuthBackground } from '@/components/auth-background'

export const metadata = { title: pageTitle('Sign up') }

export default function SignUpPage() {
  return (
    <>
      <AuthBackground />
      <AuthForm
        title="Build your split"
        subtitle="Plan your week, log every set, watch it add up."
        submitLabel="Create account"
        action={signUp}
        passwordAutoComplete="new-password"
        footer={{
          text: 'Already have an account?',
          linkLabel: 'Sign in',
          href: '/sign-in',
        }}
      />
    </>
  )
}
