'use client'

import { useMemo, useState, useTransition } from 'react'

import { saveProgram } from '@/app/(app)/program/actions'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  DumbbellIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons'
import { ActionButton, Banner, Select, TextField } from '@/components/ui'
import type { CatalogCategory } from '@/lib/catalog-types'
import {
  DAY_LABELS,
  DAY_SHORT,
  DAYS_OF_WEEK,
  type DayOfWeek,
  type DraftDay,
  type Program,
} from '@/lib/program-types'

/** A row in the builder. Mirrors DraftExercise plus the cascade's own state. */
type Row = {
  key: string
  id?: string
  categoryId: string
  subcategoryId: string
  exerciseId: string
  prescribedReps: string
  customFields: { key: string; value: string }[]
}

type DayState = {
  title: string
  isRestDay: boolean
  rows: Row[]
}

let keyCounter = 0
const nextKey = () => `row-${++keyCounter}`

function buildInitialState(
  program: Program,
  catalog: CatalogCategory[],
): Record<DayOfWeek, DayState> {
  // Resolve each saved exercise back up to its subcategory and category so the
  // cascading selects open on the right values.
  const lookup = new Map<
    string,
    { subcategoryId: string; categoryId: string }
  >()
  for (const category of catalog) {
    for (const subcategory of category.subcategories) {
      for (const exercise of subcategory.exercises) {
        lookup.set(exercise.id, {
          subcategoryId: subcategory.id,
          categoryId: category.id,
        })
      }
    }
  }

  const state = {} as Record<DayOfWeek, DayState>
  for (const day of program.days) {
    state[day.day_of_week] = {
      title: day.title ?? '',
      isRestDay: day.is_rest_day,
      rows: day.exercises.map((exercise) => {
        const parents = lookup.get(exercise.exercise_id)
        return {
          key: nextKey(),
          id: exercise.id,
          categoryId: parents?.categoryId ?? '',
          subcategoryId: parents?.subcategoryId ?? '',
          exerciseId: exercise.exercise_id,
          prescribedReps: exercise.prescribed_reps ?? '',
          customFields: Object.entries(exercise.custom_fields ?? {}).map(
            ([key, value]) => ({ key, value }),
          ),
        }
      }),
    }
  }
  return state
}

function toDraft(state: Record<DayOfWeek, DayState>): DraftDay[] {
  return DAYS_OF_WEEK.map((dow) => {
    const day = state[dow]
    return {
      day_of_week: dow,
      title: day.title,
      is_rest_day: day.isRestDay,
      exercises: day.rows
        // A half-finished cascade is not a real entry; drop it rather than
        // failing the whole save.
        .filter((row) => row.exerciseId)
        .map((row) => ({
          id: row.id,
          exercise_id: row.exerciseId,
          prescribed_reps: row.prescribedReps,
          custom_fields: Object.fromEntries(
            row.customFields
              .filter((f) => f.key.trim())
              .map((f) => [f.key.trim(), f.value]),
          ),
        })),
    }
  })
}

export function ProgramBuilder({
  program,
  catalog,
}: {
  program: Program
  catalog: CatalogCategory[]
}) {
  const [state, setState] = useState(() => buildInitialState(program, catalog))
  const [editing, setEditing] = useState(false)
  const [openDay, setOpenDay] = useState<DayOfWeek | null>(null)
  const [message, setMessage] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const exercisesById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of catalog)
      for (const s of c.subcategories)
        for (const e of s.exercises) map.set(e.id, e.name)
    return map
  }, [catalog])

  function updateDay(dow: DayOfWeek, patch: Partial<DayState>) {
    setState((prev) => ({ ...prev, [dow]: { ...prev[dow], ...patch } }))
    setMessage(null)
  }

  function updateRow(dow: DayOfWeek, key: string, patch: Partial<Row>) {
    setState((prev) => ({
      ...prev,
      [dow]: {
        ...prev[dow],
        rows: prev[dow].rows.map((r) =>
          r.key === key ? { ...r, ...patch } : r,
        ),
      },
    }))
    setMessage(null)
  }

  function addRow(dow: DayOfWeek) {
    updateDay(dow, {
      rows: [
        ...state[dow].rows,
        {
          key: nextKey(),
          categoryId: '',
          subcategoryId: '',
          exerciseId: '',
          prescribedReps: '',
          customFields: [],
        },
      ],
    })
  }

  function removeRow(dow: DayOfWeek, key: string) {
    updateDay(dow, { rows: state[dow].rows.filter((r) => r.key !== key) })
  }

  function moveRow(dow: DayOfWeek, index: number, delta: number) {
    const rows = [...state[dow].rows]
    const target = index + delta
    if (target < 0 || target >= rows.length) return
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
    updateDay(dow, { rows })
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const result = await saveProgram(toDraft(state))
      if (result.ok) {
        setMessage({ tone: 'success', text: 'Program saved.' })
        setEditing(false)
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  return (
    <main className="px-4 pt-2">
      <header className="flex items-start justify-between gap-3 px-1 pb-5">
        <div>
          <p className="label-caps">Weekly Template</p>
          <h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight text-primary">
            {program.name}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v)
            setMessage(null)
          }}
          aria-label={editing ? 'Leave edit mode' : 'Edit program'}
          aria-pressed={editing}
          className={`surface flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
            editing ? 'border-danger/50 text-danger' : 'text-secondary'
          }`}
        >
          {editing ? (
            <ArrowLeftIcon className="h-5 w-5" />
          ) : (
            <PencilIcon className="h-5 w-5" />
          )}
        </button>
      </header>

      {message && (
        <div className="mb-4">
          <Banner tone={message.tone}>{message.text}</Banner>
        </div>
      )}

      <div className="space-y-3">
        {DAYS_OF_WEEK.map((dow) => {
          const day = state[dow]
          const open = openDay === dow
          const count = day.rows.filter((r) => r.exerciseId).length

          return (
            <section key={dow}>
              <h2>
                <button
                  type="button"
                  onClick={() => setOpenDay(open ? null : dow)}
                  aria-expanded={open}
                  aria-controls={`day-${dow}`}
                  className={`surface flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors ${
                    open ? 'border-danger/40' : ''
                  }`}
                >
                  <span className="w-11 shrink-0 text-[13px] font-bold tracking-[0.1em] text-faint uppercase">
                    {DAY_SHORT[dow]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-bold tracking-tight text-primary">
                      {day.title.trim() ||
                        (day.isRestDay ? 'Rest Day' : DAY_LABELS[dow])}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-secondary">
                      {day.isRestDay
                        ? 'Rest'
                        : count === 0
                          ? 'No exercises yet'
                          : `${count} exercise${count === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  {day.isRestDay && (
                    <span className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-faint uppercase">
                      Rest
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-180 text-danger' : 'text-faint'
                    }`}
                  />
                </button>
              </h2>

              {open && (
                <div id={`day-${dow}`} className="mt-3 space-y-3 pl-3">
                  <DayPanel
                    dow={dow}
                    day={day}
                    catalog={catalog}
                    editing={editing}
                    exercisesById={exercisesById}
                    onUpdateDay={(patch) => updateDay(dow, patch)}
                    onUpdateRow={(key, patch) => updateRow(dow, key, patch)}
                    onAddRow={() => addRow(dow)}
                    onRemoveRow={(key) => removeRow(dow, key)}
                    onMoveRow={(index, delta) => moveRow(dow, index, delta)}
                  />
                </div>
              )}
            </section>
          )
        })}
      </div>

      {editing && (
        <div className="sticky bottom-4 mt-5">
          <ActionButton
            tone="danger"
            onClick={handleSave}
            disabled={pending}
            className="w-full"
          >
            {pending ? 'Saving…' : 'Save Program'}
          </ActionButton>
        </div>
      )}
    </main>
  )
}

function DayPanel({
  dow,
  day,
  catalog,
  editing,
  exercisesById,
  onUpdateDay,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onMoveRow,
}: {
  dow: DayOfWeek
  day: DayState
  catalog: CatalogCategory[]
  editing: boolean
  exercisesById: Map<string, string>
  onUpdateDay: (patch: Partial<DayState>) => void
  onUpdateRow: (key: string, patch: Partial<Row>) => void
  onAddRow: () => void
  onRemoveRow: (key: string) => void
  onMoveRow: (index: number, delta: number) => void
}) {
  if (!editing) {
    return (
      <article className="surface overflow-hidden rounded-2xl">
        {day.isRestDay ? (
          <div className="px-5 py-8 text-center">
            <p className="label-caps">Rest Day</p>
            <p className="mt-2 text-sm text-secondary">
              No exercises scheduled for {DAY_LABELS[dow]}.
            </p>
          </div>
        ) : day.rows.filter((r) => r.exerciseId).length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-secondary">
              Nothing scheduled yet. Tap the pencil to start building.
            </p>
          </div>
        ) : (
          <ul>
            {day.rows
              .filter((r) => r.exerciseId)
              .map((row, index) => (
                <li
                  key={row.key}
                  className="flex items-center gap-3.5 border-t border-hairline/60 px-5 py-3.5 first:border-t-0"
                >
                  <span className="w-5 shrink-0 text-[13px] font-semibold text-faint tabular-nums">
                    {index + 1}
                  </span>
                  <DumbbellIcon className="h-5 w-5 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-primary">
                      {exercisesById.get(row.exerciseId) ?? 'Unknown exercise'}
                    </span>
                    {row.prescribedReps && (
                      <span className="mt-0.5 block text-[13px] text-secondary">
                        {row.prescribedReps}
                      </span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </article>
    )
  }

  return (
    <article className="surface space-y-4 rounded-2xl p-5">
      <TextField
        label="Day title"
        value={day.title}
        onChange={(title) => onUpdateDay({ title })}
        placeholder={`e.g. Chest & Tri`}
      />

      <label className="flex min-h-[46px] items-center justify-between gap-4 rounded-xl border border-hairline bg-card-raised px-4">
        <span className="text-[15px] text-primary">Rest day</span>
        <input
          type="checkbox"
          checked={day.isRestDay}
          onChange={(e) => onUpdateDay({ isRestDay: e.target.checked })}
          className="h-6 w-6 accent-[var(--color-danger)]"
        />
      </label>

      {day.isRestDay ? (
        <p className="rounded-xl border border-hairline bg-card-raised/50 px-4 py-3 text-[13px] leading-relaxed text-secondary">
          Marked as rest. Saving clears any exercises on this day.
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {day.rows.map((row, index) => (
              <ExerciseRow
                key={row.key}
                row={row}
                index={index}
                total={day.rows.length}
                catalog={catalog}
                onChange={(patch) => onUpdateRow(row.key, patch)}
                onRemove={() => onRemoveRow(row.key)}
                onMove={(delta) => onMoveRow(index, delta)}
              />
            ))}
          </div>

          <ActionButton onClick={onAddRow} className="w-full">
            <span className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Add exercise
            </span>
          </ActionButton>
        </>
      )}
    </article>
  )
}

function ExerciseRow({
  row,
  index,
  total,
  catalog,
  onChange,
  onRemove,
  onMove,
}: {
  row: Row
  index: number
  total: number
  catalog: CatalogCategory[]
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const category = catalog.find((c) => c.id === row.categoryId)
  const subcategory = category?.subcategories.find(
    (s) => s.id === row.subcategoryId,
  )

  return (
    <div className="space-y-3 rounded-xl border border-hairline bg-base/40 p-3.5">
      <div className="flex items-center justify-between">
        <span className="label-caps">Exercise {index + 1}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={`Move exercise ${index + 1} up`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary disabled:opacity-30"
          >
            <ChevronDownIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={`Move exercise ${index + 1} down`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-secondary disabled:opacity-30"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove exercise ${index + 1}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:text-danger"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Three-level cascade: each level filters the next. */}
      <Select
        label="Category"
        placeholder="Select category"
        value={row.categoryId}
        options={catalog}
        onChange={(categoryId) =>
          onChange({ categoryId, subcategoryId: '', exerciseId: '' })
        }
      />
      <Select
        label="Subcategory"
        placeholder={category ? 'Select subcategory' : 'Pick a category first'}
        value={row.subcategoryId}
        disabled={!category}
        options={category?.subcategories ?? []}
        onChange={(subcategoryId) =>
          onChange({ subcategoryId, exerciseId: '' })
        }
      />
      <Select
        label="Exercise"
        placeholder={
          subcategory ? 'Select exercise' : 'Pick a subcategory first'
        }
        value={row.exerciseId}
        disabled={!subcategory}
        options={subcategory?.exercises ?? []}
        onChange={(exerciseId) => onChange({ exerciseId })}
      />

      <TextField
        label="Prescribed reps"
        value={row.prescribedReps}
        onChange={(prescribedReps) => onChange({ prescribedReps })}
        placeholder="e.g. 3x6-10"
      />

      <CustomFields
        fields={row.customFields}
        onChange={(customFields) => onChange({ customFields })}
      />
    </div>
  )
}

/**
 * Optional key/value pairs stored in program_exercises.custom_fields (jsonb).
 * This is the spreadsheet-flexibility escape hatch from PRD §8.6 — RPE, tempo,
 * machine setting — without a schema change per attribute.
 */
function CustomFields({
  fields,
  onChange,
}: {
  fields: { key: string; value: string }[]
  onChange: (fields: { key: string; value: string }[]) => void
}) {
  const [open, setOpen] = useState(fields.length > 0)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          // Open with a blank pair ready, so one tap is enough to start typing.
          if (fields.length === 0) onChange([{ key: '', value: '' }])
        }}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary hover:text-primary"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add custom field
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <span className="label-caps">Custom fields</span>
      {fields.map((field, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={field.key}
            placeholder="Name (e.g. RPE)"
            onChange={(e) =>
              onChange(
                fields.map((f, j) =>
                  j === i ? { ...f, key: e.target.value } : f,
                ),
              )
            }
            className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-hairline bg-card-raised px-3 text-sm text-primary placeholder:text-faint"
          />
          <input
            type="text"
            value={field.value}
            placeholder="Value"
            onChange={(e) =>
              onChange(
                fields.map((f, j) =>
                  j === i ? { ...f, value: e.target.value } : f,
                ),
              )
            }
            className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-hairline bg-card-raised px-3 text-sm text-primary placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
            aria-label={`Remove custom field ${i + 1}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-faint hover:text-danger"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...fields, { key: '', value: '' }])}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-secondary hover:text-primary"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add another
      </button>
    </div>
  )
}
