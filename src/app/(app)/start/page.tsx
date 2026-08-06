import { PhasePlaceholder } from '@/components/phase-placeholder'

export const metadata = { title: 'Start · AJFit' }

export default function StartPage() {
  return (
    <PhasePlaceholder
      title="Start Workout"
      phase="Phase 4"
      icon="play"
      description="Session logging — timer, per-set entry, and per-exercise notes — lands here."
    />
  )
}
