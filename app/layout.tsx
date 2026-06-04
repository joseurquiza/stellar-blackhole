import type { Metadata } from 'next'
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
  description: 'Action Tokens powers a platform where creators, brands, and communities can own customizable PLOTs and unlock experiences through AR, Virtual Worlds, and Web3 utilities.',
  icons: {
    icon: '/images/action-tokens-logo.jpg',
    shortcut: '/images/action-tokens-logo.jpg',
    apple: '/images/action-tokens-logo.jpg',
  },
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
