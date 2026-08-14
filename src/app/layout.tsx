import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
}

export const viewport: Viewport = {
  themeColor: '#13161B',
  // The app is built for one-handed phone use; block pinch-zoom drift on inputs.
  width: 'device-width',
  initialScale: 1,
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
      </body>
    </html>
  )
}
