import { Rocket } from 'lucide-react'
import Link from "next/link"
import Image from "next/image"
import { MobileMenu } from "./mobile-menu"
import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 md:p-6 border-b border-gray-800">
      <Link href="/" className="flex items-center gap-3">
        <Image
          src="/images/action-tokens-logo.jpg"
          alt="Action Tokens"
          width={40}
          height={40}
          className="rounded-lg"
        />
        <span className="text-xl font-bold">Action Tokens</span>
      </Link>
      
      {/* Desktop Navigation */}
      <nav className="hidden lg:flex items-center gap-6 text-gray-300">
        <Link href="/" className="hover:text-white transition-colors">
          Home
        </Link>
      </nav>
      
      {/* Desktop Launch Button + Theme Toggle */}
      <div className="hidden lg:flex items-center gap-3">
        <ThemeToggle />
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
          <Link
            href="https://app.action-tokens.com/"
            className="relative px-6 py-2 bg-black rounded-full flex items-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            <span>Launch WebApp</span>
          </Link>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu />
    </header>
  )
}
