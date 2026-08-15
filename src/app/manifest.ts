import type { MetadataRoute } from 'next'

/**
 * Web app manifest — what makes AJFit installable to a phone home screen.
 *
 * `display: 'standalone'` is the point of the exercise: launched from the home
 * screen the app opens without browser chrome, which matters because the whole
 * UI was built around a fixed bottom navigation that fights Safari's toolbar.
 *
 * Colours come straight from the design language rather than being re-picked:
 * #13161B is `bg-base`, and using it for both theme and background means the
 * splash screen and the status bar are the same dark the app already is — no
 * white flash between tapping the icon and the first paint.
 *
 * Two icon purposes are declared because Android treats them differently. A
 * `maskable` icon is cropped to whatever shape the launcher uses, so it is
 * drawn full-bleed with the mark inside the safe zone; an `any` icon is placed
 * as-is, so it is the rounded tile. Shipping only one means either a floating
 * mark on a plain square or a monogram with its corners cut off.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AJFit',
    short_name: 'AJFit',
    description: 'Personal workout programming and logging',
    start_url: '/',
    // Scope covers the whole origin so an in-app link never kicks the user out
    // of the installed window and back into a browser tab.
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#13161B',
    theme_color: '#13161B',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
