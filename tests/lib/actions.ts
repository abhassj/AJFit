/**
 * Calling Server Actions the way an attacker would: as plain HTTP POSTs.
 *
 * A Server Action is a public endpoint — a POST to a page with a Next-Action
 * header naming the action's id. The ids are only known at build time, so they
 * are read from the build's server-reference manifest. That manifest is the
 * authoritative list of what is callable: an action no client module imports
 * is stripped from the client bundles and has no id, hence no endpoint.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { APIRequestContext } from '@playwright/test'

import { APP_URL } from './browser'

export type ManifestAction = {
  id: string
  name: string
  file: string
  /** A page the action is registered on, as a URL path to POST to. */
  route: string
}

const MANIFEST = path.resolve(
  __dirname,
  '../../.next/server/server-reference-manifest.json',
)

/** Turns a worker key like "app/(app)/history/[date]/page" into a URL path. */
function workerToRoute(worker: string): string {
  const parts = worker
    .replace(/^app\//, '')
    .replace(/\/?page$/, '')
    .split('/')
    .filter((p) => p && !/^\(.*\)$/.test(p))
    .map((p) => (p === '[date]' ? '2026-09-07' : p))
  return `/${parts.join('/')}`
}

export function manifestActions(): ManifestAction[] {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  return Object.entries(
    manifest.node as Record<
      string,
      {
        exportedName: string
        filename: string
        workers: Record<string, unknown>
      }
    >,
  ).map(([id, v]) => ({
    id,
    name: v.exportedName,
    file: v.filename,
    route: workerToRoute(Object.keys(v.workers)[0]),
  }))
}

export type ActionResponse = {
  status: number
  /** x-action-redirect, e.g. "/sign-in;push", or null. */
  redirect: string | null
  body: string
}

const headersFor = (id: string) => ({
  'Next-Action': id,
  'Content-Type': 'text/plain;charset=UTF-8',
  Accept: 'text/x-component',
})

/** Calls an action with no cookies at all. */
export async function callAnonymous(
  action: Pick<ManifestAction, 'id' | 'route'>,
  args: unknown[],
): Promise<ActionResponse> {
  const res = await fetch(`${APP_URL}${action.route}`, {
    method: 'POST',
    headers: headersFor(action.id),
    body: JSON.stringify(args),
    redirect: 'manual',
  })
  return {
    status: res.status,
    redirect: res.headers.get('x-action-redirect'),
    body: await res.text(),
  }
}

/** Calls an action with a signed-in browser context's cookies. */
export async function callAs(
  request: APIRequestContext,
  action: Pick<ManifestAction, 'id' | 'route'>,
  args: unknown[],
): Promise<ActionResponse> {
  const res = await request.post(`${APP_URL}${action.route}`, {
    headers: headersFor(action.id),
    data: JSON.stringify(args),
    maxRedirects: 0,
  })
  return {
    status: res.status(),
    redirect: res.headers()['x-action-redirect'] ?? null,
    body: await res.text(),
  }
}

/** The action's return value, pulled out of the RSC response body. */
export function resultOf(body: string): { ok?: boolean; error?: string } {
  const ok = body.match(/"ok":(true|false)/)
  const error = body.match(/"error":"((?:[^"\\]|\\.)*)"/)
  return {
    ok: ok ? ok[1] === 'true' : undefined,
    error: error ? JSON.parse(`"${error[1]}"`) : undefined,
  }
}
