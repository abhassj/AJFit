import Image from 'next/image'

import bgTexture from '@/assets/bg-texture.jpeg'

/**
 * Backdrop for the signed-out pages.
 *
 * Auth is the sparsest screen in the app and the first thing anyone sees, so
 * the figure gets its fullest presence here. Same performance rules as the
 * in-app backdrop: next/image so it ships as AVIF, and no blend modes.
 *
 * This is a server component — the auth pages sit outside the (app) group and
 * have no route-dependent variant to resolve, so there is nothing to make it a
 * client component for.
 */
export function AuthBackground() {
  const mask =
    'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,1) 26%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0) 86%)'

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-base" />

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 80% at 50% -8%, rgba(160, 30, 40, 0.40) 0%, rgba(76, 18, 26, 0.20) 42%, rgba(19, 22, 27, 0) 76%)',
        }}
      />

      {/*
       * Lifted and dimmed so the figure's face clears the wordmark and heading
       * below it — at full strength the bright face sat directly behind the red
       * "AJFit" mark and cost it too much contrast.
       */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden opacity-[0.3]"
        style={{ height: '88vh', maskImage: mask, WebkitMaskImage: mask }}
      >
        <Image
          src={bgTexture}
          alt=""
          priority
          fetchPriority="high"
          sizes="100vw"
          className="h-full w-full object-cover object-top"
          style={{ transform: 'scale(1.45) translateY(-24%)' }}
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 72% at 50% 30%, rgba(19,22,27,0) 42%, rgba(19,22,27,0.5) 78%, rgba(19,22,27,0.9) 100%)',
        }}
      />
    </div>
  )
}
