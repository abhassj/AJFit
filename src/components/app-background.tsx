/**
 * Ambient page backdrop.
 *
 * The design doc drops the mockups' character artwork as foreground branding;
 * it survives here only as atmosphere — fixed behind the content and faded out
 * before it reaches the cards, so it never competes with text. The maroon glow
 * is the same background ambience sampled from the mockups, which the doc notes
 * is a backdrop effect rather than a UI token.
 *
 * The source image is near-black with a bright rim light, so it is composited
 * with `screen`: only the highlights contribute and the black field drops out
 * entirely, which keeps the figure from muddying the base colour.
 */
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-base" />

      {/* Deep red ambience, strongest behind the top of the page. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 75% at 50% -5%, rgba(150, 28, 37, 0.38) 0%, rgba(72, 17, 25, 0.20) 40%, rgba(19, 22, 27, 0) 74%)',
        }}
      />

      {/*
       * The mockup figure, as texture only. Scaled up and anchored high so the
       * head and shoulders land in the header's negative space rather than
       * directly behind the first card, and faded out well before the bottom
       * navigation.
       */}
      <div
        className="absolute inset-x-0 top-0 h-[80vh] bg-no-repeat opacity-[0.28] mix-blend-screen"
        style={{
          backgroundImage: 'url(/bg-texture.jpeg)',
          backgroundSize: '150% auto',
          // Pulled up so the head sits behind the header rather than behind
          // body copy, and the arms trail off through the upper third.
          backgroundPosition: 'center -235px',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0) 74%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.45) 48%, rgba(0,0,0,0) 74%)',
        }}
      />

      {/* Vignette — settles the edges back toward the base colour. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(115% 70% at 50% 28%, rgba(19,22,27,0) 45%, rgba(19,22,27,0.45) 80%, rgba(19,22,27,0.85) 100%)',
        }}
      />

      {/* Keep the very bottom clean behind the fixed navigation. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-base" />
    </div>
  )
}
