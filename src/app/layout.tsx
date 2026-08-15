import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { ServiceWorkerRegistrar } from '@/components/service-worker'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'AJFit',
  description: 'Personal workout programming and logging',
  // iOS ignores the web manifest for home-screen installs and reads these
  // instead: without them, Add to Home Screen produces a Safari screenshot as
  // the icon and opens the app in a browser tab rather than full screen.
  appleWebApp: {
    capable: true,
    title: 'AJFit',
    // The app paints its own dark ground to the top edge, so the status bar
    // should sit over it rather than on an opaque bar of its own.
    statusBarStyle: 'black-translucent',
  },
  other: {
    /*
     * `appleWebApp.capable` now emits the standardised
     * `mobile-web-app-capable`, which Safari only began honouring in iOS 16.4.
     * Anyone on an older iPhone would get an Add to Home Screen shortcut that
     * opens in a Safari tab with the toolbar covering the bottom navigation.
     * The legacy tag is two lines and fixes that; browsers that understand the
     * standard name simply see the same value twice.
     */
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#13161B',
  // The app is built for one-handed phone use; block pinch-zoom drift on inputs.
  width: 'device-width',
  initialScale: 1,
  // Installed full-screen, the layout must reach under the notch and home
  // indicator — every fixed element already offsets itself with env(safe-area-*).
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // `dark` is fixed on: AJFit has no light theme (docs/AJFit_Design_Language.md).
    //
    // suppressHydrationWarning is scoped to <html> and <body> on purpose.
    // Browser extensions inject attributes onto these two elements before React
    // hydrates — a Scribe recorder adding data-scribe-recorder-ready is what
    // surfaced it here, and password managers and theme switchers do the same.
    // Nothing in this app writes those attributes, so the mismatch is never
    // ours to fix. The flag only covers the element's own attributes, one level
    // deep, so a genuine mismatch anywhere inside the tree still reports.
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
