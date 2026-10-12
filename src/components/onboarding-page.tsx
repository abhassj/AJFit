'use client'

import { useRouter } from 'next/navigation'

import {
  OnboardingForm,
  type OnboardingInitial,
} from '@/components/onboarding-form'
import { BRAND } from '@/lib/brand'

export function OnboardingPage({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter()
  return (
    <main className="px-4 pt-2 pb-6">
      <header className="px-1 pb-5">
        <p className="label-caps">Welcome to {BRAND.name}</p>
        <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
          Set up your profile
        </h1>
        <p className="mt-1.5 text-sm text-secondary">
          Your weight and height set up your units and BMI. You can change any
          of this later on your Profile.
        </p>
      </header>
      <section className="surface rounded-2xl p-5">
        <OnboardingForm initial={initial} onDone={() => router.replace('/')} />
      </section>
    </main>
  )
}
