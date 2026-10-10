/**
 * A v4 UUID generated on the client, so a row's id exists before the server
 * has seen it: the UI can show the row immediately and a retried save can be
 * recognised as the same row.
 *
 * crypto.randomUUID() only exists in secure contexts. Opening the dev server
 * from a phone over the LAN (plain http) is not one, so fall back to building
 * the same v4 layout from getRandomValues, which is available everywhere.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
