import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'Action Tokens - Empowering Positive Actions Through Blockchain',
  description:
    'Action Tokens powers a platform where creators, brands, and communities can own customizable PLOTs and unlock experiences through AR, Virtual Worlds, and Web3 utilities.',
  icons: {
    icon: '/images/action-tokens-logo.jpg',
    shortcut: '/images/action-tokens-logo.jpg',
    apple: '/images/action-tokens-logo.jpg',
  },
}

// Keep zoom enabled for accessibility (WCAG 1.4.4 Resize Text); theme-color
// follows the light/dark cosmic backgrounds used across the app.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#070912' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} font-sans antialiased`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <div className="site-shell">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  )
}
