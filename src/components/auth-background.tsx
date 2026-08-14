import Image from 'next/image'

import bgTexture from '@/assets/bg-texture.jpeg'

/**
 * Backdrop for the signed-out pages.
 *
 * Auth is the sparsest screen in the app and the first thing anyone sees, so
 * the figure gets its fullest presence here. Same performance rules as the
 * in-app backdrop: next/image so it ships as AVIF, and no blend modes.
 *
 * Framing note. This used to be a fixed-height box with
 * `transform: scale(1.45) translateY(-24%)` on top of an object-cover image,
 * which cropped the figure's head off. Two reasons: a transform's translate
 * resolves in the *scaled* coordinate system, so the -24% actually shifted by
 * roughly -35%, and a fixed `vh` height re-crops differently at every viewport
 * aspect ratio.
 *
 * It is now a full-bleed `fill` + `object-cover` image positioned with
 * `object-position` alone. Cover guarantees the frame is always filled with no
 * letterboxing, and object-position is resolution-independent, so the framing
 * holds identically on a short phone and a tall one.
 *
 * This is a server component — the auth pages sit outside the (app) group and
 * have no route-dependent variant to resolve, so there is nothing to make it a
 * client component for.
 */
export function AuthBackground() {
  // Keeps the figure strong behind the wordmark, then clears the ground well
  // before the form card so the inputs never sit on busy artwork.
  const mask =
    'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.1) 78%, rgba(0,0,0,0) 90%)'

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-base" />

      {/* Deep red ambience, strongest behind the top of the page. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(130% 80% at 50% -8%, rgba(160, 30, 40, 0.38) 0%, rgba(76, 18, 26, 0.20) 42%, rgba(19, 22, 27, 0) 76%)',
        }}
      />

      {/*
       * The container is deliberately SHORTER than the viewport (62vh, anchored
       * top). This artwork is portrait, so in a full-height box object-cover
       * always matches by height, leaves no vertical overflow, and object-position
       * does nothing — the figure spans top to bottom and its face lands exactly
       * where the form card starts. Constraining the height creates vertical
       * overflow, which is what lets object-position lift the head into the
       * masthead area above the form. The shorter the box, the more overflow
       * there is and the more travel object-position has: at 62vh there was
       * only ~100px to play with and the face still landed on the wordmark.
       * Still no transform, so the framing is deterministic at any aspect ratio.
       */}
      <div
        className="absolute inset-x-0 top-0 h-[48vh] overflow-hidden opacity-[0.45]"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        <Image
          src={bgTexture}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          // Lifts the head and shoulders into the upper third, where only the
          // wordmark and heading sit, rather than behind the form.
          className="object-cover"
          style={{ objectPosition: 'center 58%' }}
        />
      </div>

      {/* Vignette — settles the edges back toward the base colour. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 78% at 50% 24%, rgba(19,22,27,0) 46%, rgba(19,22,27,0.38) 78%, rgba(19,22,27,0.9) 100%)',
        }}
      />
    </div>
  )
}
