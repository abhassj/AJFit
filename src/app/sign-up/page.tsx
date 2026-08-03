import { signUp } from '@/app/auth/actions'
import { AuthForm } from '@/app/auth/auth-form'

export default function SignUpPage() {
  return (
    <AuthForm
      title="Create your AJFit account"
      submitLabel="Sign up"
      action={signUp}
      footer={{
        text: 'Already have an account?',
        linkLabel: 'Sign in',
        href: '/sign-in',
      }}
    />
  )
}
