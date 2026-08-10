'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { FadeIn, MotionProvider } from '@/components/motion'
import { Banner } from '@/components/ui'

import type { AuthState } from './actions'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 min-h-[52px] w-full rounded-xl bg-primary text-sm font-bold tracking-wide text-base uppercase transition-colors hover:bg-primary/90 disabled:opacity-50"
    >
      {pending ? 'Working…' : label}
    </button>
  )
}

function Field({
  label,
  name,
  type,
  autoComplete,
  minLength,
}: {
  label: string
  name: string
  type: string
  autoComplete: string
  minLength?: number
}) {
  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        className="mt-1.5 min-h-[50px] w-full rounded-xl border border-hairline bg-card-raised px-4 text-[16px] text-primary transition-colors placeholder:text-faint focus:border-danger/60 focus:outline-none"
      />
    </label>
  )
}

type AuthFormProps = {
  title: string
  subtitle: string
  submitLabel: string
  action: (state: AuthState, formData: FormData) => Promise<AuthState>
  footer: { text: string; linkLabel: string; href: string }
  passwordAutoComplete: string
}

export function AuthForm({
  title,
  subtitle,
  submitLabel,
  action,
  footer,
  passwordAutoComplete,
}: AuthFormProps) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {})

  return (
    <MotionProvider>
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
        <FadeIn>
          <div className="pb-7 text-center">
            <p className="text-[13px] font-bold tracking-[0.28em] text-danger uppercase">
              AJFit
            </p>
            <h1 className="mt-3 text-[30px] leading-tight font-bold tracking-tight text-primary">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-secondary">
              {subtitle}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.08}>
          <div className="surface rounded-2xl p-6">
            <form action={formAction} className="flex flex-col gap-4">
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
              />
              <Field
                label="Password"
                name="password"
                type="password"
                autoComplete={passwordAutoComplete}
                minLength={6}
              />
              <SubmitButton label={submitLabel} />
            </form>

            {state.error && (
              <div className="mt-4">
                <Banner tone="error">{state.error}</Banner>
              </div>
            )}
            {state.message && (
              <div className="mt-4">
                <Banner tone="success">{state.message}</Banner>
              </div>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.16}>
          <p className="pt-6 text-center text-sm text-secondary">
            {footer.text}{' '}
            <Link
              href={footer.href}
              className="font-semibold text-primary underline underline-offset-4"
            >
              {footer.linkLabel}
            </Link>
          </p>
        </FadeIn>
      </main>
    </MotionProvider>
  )
}
