/**
 * Avatar bubble. Falls back to initials so the shell never shows a broken or
 * empty circle for a user who has not uploaded a picture.
 */
export function initialsFor(displayName: string | null, email: string): string {
  const source = displayName?.trim() || email.trim()
  if (!source) return '?'
  const words = source.split(/[\s._-]+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return source.slice(0, 2).toUpperCase()
}

export function Avatar({
  avatarUrl,
  displayName,
  email,
  size = 36,
  className = '',
}: {
  avatarUrl: string | null
  displayName: string | null
  email: string
  size?: number
  className?: string
}) {
  const initials = initialsFor(displayName, email)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-card-raised ${className}`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        // Storage avatars are arbitrary remote URLs, so this stays a plain
        // <img>; routing it through next/image would need the Supabase host in
        // remotePatterns and buys little for a 36px bubble.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-semibold text-secondary"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
