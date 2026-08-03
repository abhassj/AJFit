import { signIn } from '@/app/auth/actions'
import { AuthForm } from '@/app/auth/auth-form'

export default function SignInPage() {
  return (
    <AuthForm
      title="Sign in to AJFit"
      submitLabel="Sign in"
      action={signIn}
      footer={{
        text: 'No account yet?',
        linkLabel: 'Sign up',
        href: '/sign-up',
      }}
    />
  )
}
