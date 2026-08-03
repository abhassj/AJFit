'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import type { AuthState } from './actions'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-black/20 px-4 py-2 disabled:opacity-50 dark:border-white/30"
    >
      {pending ? 'Working…' : label}
    </button>
  )
}

type AuthFormProps = {
  title: string
  submitLabel: string
  action: (state: AuthState, formData: FormData) => Promise<AuthState>
  footer: { text: string; linkLabel: string; href: string }
}

export function AuthForm({
  title,
  submitLabel,
  action,
  footer,
}: AuthFormProps) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {})

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{title}</h1>

      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded border border-black/20 px-3 py-2 dark:border-white/30"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={6}
            className="rounded border border-black/20 px-3 py-2 dark:border-white/30"
          />
        </label>

        <SubmitButton label={submitLabel} />
      </form>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state.message ? <p className="text-sm">{state.message}</p> : null}

      <p className="text-sm">
        {footer.text}{' '}
        <Link href={footer.href} className="underline">
          {footer.linkLabel}
        </Link>
      </p>
    </main>
  )
}
