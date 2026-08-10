import { signUp } from '@/app/auth/actions'
import { AuthForm } from '@/app/auth/auth-form'
import { AuthBackground } from '@/components/auth-background'

export const metadata = { title: 'Sign up · AJFit' }

export default function SignUpPage() {
  return (
    <>
      <AuthBackground />
      <AuthForm
        title="Build your program"
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
