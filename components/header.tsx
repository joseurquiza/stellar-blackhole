import Link from "next/link"
import Image from "next/image"
import { MobileMenu } from "./mobile-menu"
import { ThemeToggle } from "./theme-toggle"
import { BlackHoleLink } from "./blackhole-link"

export function Header() {
  return (
    <header className="flex items-center justify-between p-4 md:p-6 border-b border-gray-800">
      <Link href="/demolish" className="flex items-center gap-3">
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
        <BlackHoleLink className="hover:text-white transition-colors">
          BlackHole
        </BlackHoleLink>
      </nav>
      
      {/* Desktop Theme Toggle */}
      <div className="hidden lg:flex items-center gap-3">
        <ThemeToggle />
      </div>

      {/* Mobile Menu */}
      <MobileMenu />
    </header>
  )
}
