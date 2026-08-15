'use client'

import { m, useReducedMotion } from 'framer-motion'
import { useMemo, useState, useTransition } from 'react'

import { saveProgram } from '@/app/(app)/program/actions'
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CopyIcon,
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
import {
  DAY_TITLE_MAX,
  SPLIT_NAME_MAX,
  parseDayTitle,
  parseRestSeconds,
  parseSplitName,
} from '@/lib/validation'

/** A row in the builder. Mirrors DraftExercise plus the cascade's own state. */
type Row = {
  key: string
  id?: string
  categoryId: string
  subcategoryId: string
  exerciseId: string
  prescribedReps: string
  /** Blank string means "no rest timer", which persists as null. */
  restSeconds: string
  customFields: { key: string; value: string }[]
}

type DayState = {
  title: string
  isRestDay: boolean
  rows: Row[]
}

let keyCounter = 0
const nextKey = () => `row-${++keyCounter}`

/**
 * Everything wrong with the current draft, keyed for display.
 *
 * Collected in one pass so the Save button can be blocked and each message can
 * be shown against the field that caused it, rather than surfacing the first
 * failure as a lone banner and making the user hunt for the rest.
 */
type Problems = {
  splitName: string | null
  /** `${dow}` → message */
  dayTitle: Partial<Record<DayOfWeek, string>>
  /** row key → { field: message } */
  rows: Record<string, { exercise?: string; rest?: string }>
  /** Days that have at least one problem, for the summary banner. */
  days: DayOfWeek[]
}

function collectProblems(
  splitName: string,
  state: Record<DayOfWeek, DayState>,
): Problems {
  const problems: Problems = {
    splitName: null,
    dayTitle: {},
    rows: {},
    days: [],
  }

  const name = parseSplitName(splitName)
  if (!name.ok) problems.splitName = name.error

  for (const dow of DAYS_OF_WEEK) {
    const day = state[dow]
    let dayHasProblem = false

    const title = parseDayTitle(day.title)
    if (!title.ok) {
      problems.dayTitle[dow] = title.error
      dayHasProblem = true
    }

    // A rest day's rows are cleared on save, so validating them would block the
    // save on values that are about to be discarded.
    if (day.isRestDay) {
      if (dayHasProblem) problems.days.push(dow)
      continue
    }

    for (const row of day.rows) {
      const rowProblems: { exercise?: string; rest?: string } = {}

      // A row that is completely untouched is just an empty slot the user
      // added and has not filled yet — dropping it silently is right. A row
      // that is half-filled is a different thing: the user started choosing and
      // stopped, and losing that without a word is what this catches.
      const started = row.categoryId || row.subcategoryId || row.restSeconds
      if (!row.exerciseId && started) {
        rowProblems.exercise =
          'Finish choosing an exercise, or remove this row.'
      }

      const rest = parseRestSeconds(row.restSeconds)
      if (!rest.ok) rowProblems.rest = rest.error

      if (rowProblems.exercise || rowProblems.rest) {
        problems.rows[row.key] = rowProblems
        dayHasProblem = true
      }
    }

    if (dayHasProblem) problems.days.push(dow)
  }

  return problems
}

const hasProblems = (p: Problems) => p.splitName !== null || p.days.length > 0

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
          restSeconds: exercise.rest_seconds?.toString() ?? '',
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
        // Rows with no exercise chosen are dropped. A half-finished one is
        // caught by collectProblems() before this runs and blocks the save, so
        // the only rows reaching here are genuinely untouched empty slots.
        .filter((row) => row.exerciseId)
        .map((row) => ({
          id: row.id,
          exercise_id: row.exerciseId,
          prescribed_reps: row.prescribedReps,
          // Blank stays null: an unset rest timer is a real choice, never a
          // guessed default. Validation has already run, so the parse cannot
          // fail here; the fallback keeps the type honest rather than asserting.
          rest_seconds: (() => {
            const parsed = parseRestSeconds(row.restSeconds)
            return parsed.ok ? parsed.value : null
          })(),
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
  const [splitName, setSplitName] = useState(program.name)
  const [editing, setEditing] = useState(false)
  const [openDay, setOpenDay] = useState<DayOfWeek | null>(null)
  const [message, setMessage] = useState<{
    tone: 'error' | 'success'
    text: string
  } | null>(null)
  /**
   * Validation messages appear only after the first save attempt.
   *
   * Marking a field red the instant it is focused and still empty is hostile —
   * the user has not finished yet. Waiting until they ask to save means every
   * message shown is about something they actually consider done.
   */
  const [showProblems, setShowProblems] = useState(false)
  const [pending, startTransition] = useTransition()
  const reduced = useReducedMotion()

  const problems = useMemo(
    () => collectProblems(splitName, state),
    [splitName, state],
  )
  const blocked = hasProblems(problems)
  // Only surface them once the user has tried to save at least once.
  const visible = showProblems ? problems : null

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
          restSeconds: '',
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

  function handleCopyFrom(sourceDow: DayOfWeek, targetDow: DayOfWeek) {
    setState((prev) => ({
      ...prev,
      [targetDow]: {
        ...prev[sourceDow],
        rows: prev[sourceDow].rows.map((r) => ({
          ...r,
          key: nextKey(),
          id: undefined, // newly copied rows won't have the old DB ids
        })),
      },
    }))
    setMessage({
      tone: 'success',
      text: `Copied ${DAY_LABELS[sourceDow]} into ${DAY_LABELS[targetDow]}. Don't forget to save.`,
    })
  }

  function handleSave() {
    setMessage(null)
    setShowProblems(true)

    if (blocked) {
      // Name the days rather than saying "fix the errors" — the offending field
      // is usually inside a collapsed day the user cannot see from here.
      const where = problems.days.map((d) => DAY_LABELS[d]).join(', ')
      setMessage({
        tone: 'error',
        text: problems.splitName
          ? problems.splitName
          : `Check ${where} — something there needs fixing before this can save.`,
      })
      // Open the first day that has a problem so the inline message is visible.
      if (problems.days.length > 0) setOpenDay(problems.days[0])
      return
    }

    startTransition(async () => {
      const result = await saveProgram(splitName, toDraft(state))
      if (result.ok) {
        setMessage({ tone: 'success', text: 'Program saved.' })
        setShowProblems(false)
        setEditing(false)
      } else {
        setMessage({ tone: 'error', text: result.error })
      }
    })
  }

  return (
    <main className="px-4 pt-2">
      <header className="flex items-start justify-between gap-3 px-1 pb-5">
        <div className="min-w-0 flex-1">
          <p className="label-caps">Weekly Template</p>
          {/*
           * The split's name was previously hard-coded into this heading while
           * programs.name sat in the database unreachable. In edit mode the
           * heading becomes the field that writes it.
           */}
          {editing ? (
            <div className="mt-1.5">
              <input
                type="text"
                value={splitName}
                maxLength={SPLIT_NAME_MAX}
                aria-label="Split name"
                aria-invalid={visible?.splitName ? true : undefined}
                aria-describedby={
                  visible?.splitName ? 'split-name-error' : undefined
                }
                placeholder="Name your split"
                onChange={(e) => {
                  setSplitName(e.target.value)
                  setMessage(null)
                }}
                className={`w-full rounded-lg border bg-card-raised px-3 py-2 text-[24px] leading-tight font-black tracking-tight text-primary placeholder:font-bold placeholder:text-faint ${
                  visible?.splitName
                    ? 'border-danger/70 ring-1 ring-danger/30'
                    : 'border-hairline'
                }`}
              />
              {visible?.splitName && (
                <span
                  id="split-name-error"
                  role="alert"
                  className="mt-1.5 block text-[12px] font-medium text-danger"
                >
                  {visible.splitName}
                </span>
              )}
            </div>
          ) : (
            <h1 className="mt-1.5 truncate text-[28px] leading-tight font-black tracking-tight text-primary drop-shadow-sm">
              {splitName.trim() || 'My Workout Split'}
            </h1>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v)
            setMessage(null)
          }}
          aria-label={editing ? 'Leave edit mode' : 'Edit program'}
          aria-pressed={editing}
          className={`relative overflow-hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 backdrop-blur-xl ${
            editing
              ? 'bg-danger/20 border border-danger/40 text-danger shadow-lg'
              : 'bg-white/[0.04] border border-white/5 text-primary shadow-lg hover:bg-white/[0.08] hover:border-white/15'
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
                {/*
                 * Programs is a builder, so its rows read as controls: a solid
                 * day rail down the left edge, a fixed-width slot for the
                 * weekday, and state shown as a chip. Workouts, by contrast, is
                 * an unboxed editorial index — the two pages should not look
                 * like the same list with different words in it.
                 */}
                <m.button
                  type="button"
                  onClick={() => setOpenDay(open ? null : dow)}
                  aria-expanded={open}
                  aria-controls={`day-${dow}`}
                  whileTap={reduced ? undefined : { scale: 0.99 }}
                  transition={{ duration: 0.12 }}
                  className={`relative overflow-hidden flex w-full items-center gap-3 rounded-2xl py-3.5 pr-4 text-left transition-all duration-300 backdrop-blur-xl ${
                    open
                      ? 'bg-white/[0.08] border border-white/20 shadow-2xl'
                      : 'bg-white/[0.03] border border-white/5 shadow-lg hover:bg-white/[0.06] hover:border-white/10'
                  }`}
                >
                  <span
                    className={`flex w-14 shrink-0 flex-col items-center gap-0.5 self-stretch border-r py-1 text-[12px] font-bold tracking-[0.1em] uppercase transition-colors ${
                      open
                        ? 'border-white/20 text-danger'
                        : day.isRestDay
                          ? 'border-white/5 text-faint'
                          : 'border-white/10 text-primary/80'
                    }`}
                  >
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
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-faint uppercase">
                      Rest
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                      open ? 'rotate-180 text-danger' : 'text-faint'
                    }`}
                  />
                </m.button>
              </h2>

              {open && (
                <div id={`day-${dow}`} className="mt-3 space-y-3 pl-3">
                  <DayPanel
                    dow={dow}
                    day={day}
                    state={state}
                    catalog={catalog}
                    editing={editing}
                    problems={visible}
                    onCopyFrom={(source) => handleCopyFrom(source, dow)}
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
  state,
  catalog,
  editing,
  problems,
  onCopyFrom,
  exercisesById,
  onUpdateDay,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onMoveRow,
}: {
  dow: DayOfWeek
  day: DayState
  state: Record<DayOfWeek, DayState>
  catalog: CatalogCategory[]
  editing: boolean
  /** Null until the user has attempted a save. */
  problems: Problems | null
  onCopyFrom: (sourceDow: DayOfWeek) => void
  exercisesById: Map<string, string>
  onUpdateDay: (patch: Partial<DayState>) => void
  onUpdateRow: (key: string, patch: Partial<Row>) => void
  onAddRow: () => void
  onRemoveRow: (key: string) => void
  onMoveRow: (index: number, delta: number) => void
}) {
  if (!editing) {
    return (
      <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl">
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
                  className="flex items-center gap-3.5 border-t border-white/10 px-5 py-3.5 first:border-t-0"
                >
                  <span className="w-5 shrink-0 text-[13px] font-semibold text-faint tabular-nums">
                    {index + 1}
                  </span>
                  <DumbbellIcon className="h-5 w-5 shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-primary">
                      {exercisesById.get(row.exerciseId) ?? 'Unknown exercise'}
                    </span>
                    {(row.prescribedReps || row.restSeconds) && (
                      <span className="mt-0.5 block text-[13px] text-secondary">
                        {row.prescribedReps}
                        {row.prescribedReps && row.restSeconds && ' · '}
                        {row.restSeconds && `${row.restSeconds}s rest`}
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
    <article className="relative space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-2xl">
      <CopyFromDay dow={dow} state={state} onCopyFrom={onCopyFrom} />

      <TextField
        label="Day title"
        id={`day-title-${dow}`}
        value={day.title}
        maxLength={DAY_TITLE_MAX}
        error={problems?.dayTitle[dow] ?? null}
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
                problems={problems?.rows[row.key]}
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
  problems,
  onChange,
  onRemove,
  onMove,
}: {
  row: Row
  index: number
  total: number
  catalog: CatalogCategory[]
  problems?: { exercise?: string; rest?: string }
  onChange: (patch: Partial<Row>) => void
  onRemove: () => void
  onMove: (delta: number) => void
}) {
  const category = catalog.find((c) => c.id === row.categoryId)
  const subcategory = category?.subcategories.find(
    (s) => s.id === row.subcategoryId,
  )

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3.5 backdrop-blur-md">
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
        id={`exercise-${row.key}`}
        placeholder={
          subcategory ? 'Select exercise' : 'Pick a subcategory first'
        }
        value={row.exerciseId}
        disabled={!subcategory}
        options={subcategory?.exercises ?? []}
        // The cascade's message lands on the last step, because that is the one
        // that actually decides whether the row is real.
        error={problems?.exercise ?? null}
        onChange={(exerciseId) => onChange({ exerciseId })}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Prescribed reps"
          value={row.prescribedReps}
          maxLength={40}
          onChange={(prescribedReps) => onChange({ prescribedReps })}
          placeholder="e.g. 3x6-10"
        />
        <TextField
          label="Rest timer (sec)"
          id={`rest-${row.key}`}
          value={row.restSeconds}
          inputMode="numeric"
          maxLength={4}
          error={problems?.rest ?? null}
          onChange={(restSeconds) => onChange({ restSeconds })}
          placeholder="Optional"
        />
      </div>

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

function CopyFromDay({
  dow,
  state,
  onCopyFrom,
}: {
  dow: DayOfWeek
  state: Record<DayOfWeek, DayState>
  onCopyFrom: (sourceDow: DayOfWeek) => void
}) {
  const [source, setSource] = useState<DayOfWeek | ''>('')
  const [confirming, setConfirming] = useState(false)

  const sources = DAYS_OF_WEEK.filter(
    (d) =>
      d !== dow &&
      !state[d].isRestDay &&
      state[d].rows.filter((r) => r.exerciseId).length > 0,
  )

  if (sources.length === 0) return null

  const chosen = source ? state[source as DayOfWeek] : null

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <CopyIcon className="h-3.5 w-3.5 text-faint" />
        <span className="label-caps">Copy from another day</span>
      </div>

      {confirming && chosen ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-[13px] leading-relaxed text-secondary">
            This replaces {DAY_LABELS[dow]}&rsquo;s exercises, title and
            rest-day setting with {DAY_LABELS[source as DayOfWeek]}&rsquo;s (
            {chosen.rows.filter((r) => r.exerciseId).length} exercise
            {chosen.rows.filter((r) => r.exerciseId).length === 1 ? '' : 's'}).
            It cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <ActionButton onClick={() => setConfirming(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              tone="danger"
              onClick={() => {
                setConfirming(false)
                setSource('')
                onCopyFrom(source as DayOfWeek)
              }}
            >
              Replace
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <select
              value={source}
              aria-label={`Copy another day into ${DAY_LABELS[dow]}`}
              onChange={(e) => setSource(e.target.value as DayOfWeek | '')}
              className="min-h-[44px] w-full rounded-lg border border-hairline bg-card-raised px-3 text-[14px] text-primary"
            >
              <option value="">Select a day…</option>
              {sources.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABELS[d]} (
                  {state[d].rows.filter((r) => r.exerciseId).length})
                </option>
              ))}
            </select>
          </div>
          <ActionButton
            disabled={!chosen}
            className="shrink-0 px-4"
            onClick={() => setConfirming(true)}
          >
            Copy
          </ActionButton>
        </div>
      )}
    </div>
  )
}
