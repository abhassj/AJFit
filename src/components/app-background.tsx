'use client'

import Image from 'next/image'
import { usePathname } from 'next/navigation'

import bgTexture from '@/assets/bg-texture.jpeg'

/**
 * Ambient page backdrop.
 *
 * Two deliberate performance choices, both measured in Phase 6 Part A:
 *
 * 1. The figure goes through next/image rather than a CSS `url()`. As a raw
 *    background-image it was served as an unoptimised 52KB JPEG and cost about
 *    500ms of LCP — auth pages, which have no backdrop, measured 2.4s against
 *    2.9s for pages that do. Static-importing it lets Next emit AVIF/WebP at
 *    the right density.
 *
 * 2. No `mix-blend-mode`. Blending a fixed full-viewport layer forces the whole
 *    stacking context through the compositor every frame. The source art is
 *    near-black with a bright rim light, so plain opacity over the base colour
 *    reads almost identically without that cost.
 *
 * Placement is context-aware. Sparse pages let the figure sit centre stage;
 * dense, card-heavy pages push it up and out to the edges so it frames the
 * content instead of being buried behind a wall of panels.
 */

type Variant = 'feature' | 'edge'

/** Card-heavy routes where the backdrop must recede. */
const DENSE_PREFIXES = ['/workouts', '/program', '/start', '/history']

function variantFor(pathname: string): Variant {
  return DENSE_PREFIXES.some((p) => pathname.startsWith(p)) ? 'edge' : 'feature'
}

const SETTINGS: Record<
  Variant,
  {
    opacity: number
    heightVh: number
    offset: string
    scale: string
    mask: string
  }
> = {
  // Sign-in, Home, Profile — room to breathe, so the figure is a real presence.
  feature: {
    opacity: 0.34,
    heightVh: 82,
    offset: '-16%',
    scale: '150%',
    mask: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0) 80%)',
  },
  // Catalog, builder, session logger — pushed high and faded early so it lives
  // in the margins above and behind the cards rather than under them.
  edge: {
    opacity: 0.2,
    heightVh: 52,
    offset: '-24%',
    scale: '175%',
    mask: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.75) 28%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0) 88%)',
  },
}

export function AppBackground() {
  const pathname = usePathname()
  const variant = variantFor(pathname)
  const s = SETTINGS[variant]

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-base" />

      {/* Deep red ambience, strongest behind the top of the page. */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(125% 75% at 50% -5%, rgba(150, 28, 37, 0.34) 0%, rgba(72, 17, 25, 0.18) 40%, rgba(19, 22, 27, 0) 74%)',
          opacity: variant === 'edge' ? 0.75 : 1,
        }}
      />

      <div
        className="absolute inset-x-0 top-0 overflow-hidden transition-all duration-500"
        style={{
          height: `${s.heightVh}vh`,
          opacity: s.opacity,
          maskImage: s.mask,
          WebkitMaskImage: s.mask,
        }}
      >
        <Image
          src={bgTexture}
          alt=""
          priority
          fetchPriority="high"
          sizes="100vw"
          className="h-full w-full object-cover object-top"
          style={{ transform: `scale(${s.scale}) translateY(${s.offset})` }}
        />
      </div>

      {/* Vignette — settles the edges back toward the base colour. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(115% 70% at 50% 28%, rgba(19,22,27,0) 45%, rgba(19,22,27,0.45) 80%, rgba(19,22,27,0.88) 100%)',
        }}
      />

      {/* Keep the very bottom clean behind the fixed navigation. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-base" />
    </div>
  )
}
