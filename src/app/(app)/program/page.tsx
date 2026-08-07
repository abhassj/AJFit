import { ProgramBuilder } from '@/components/program-builder'
import { getCatalog } from '@/lib/catalog'
import { getOrCreateProgram } from '@/lib/program'

export const metadata = { title: 'Program · AJFit' }

export default async function ProgramPage() {
  const [program, catalog] = await Promise.all([
    getOrCreateProgram(),
    getCatalog(),
  ])

  return <ProgramBuilder program={program} catalog={catalog} />
}
