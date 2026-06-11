'use client'

import { useState } from 'react'
import { Menu, X, Rocket } from 'lucide-react'
import Link from "next/link"
import Image from "next/image"
import { ThemeToggle } from "./theme-toggle"

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleMenu}
        className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
        aria-label="Toggle mobile menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={closeMenu} />
          <div className="fixed top-0 right-0 h-full w-64 bg-black border-l border-gray-800 p-6">
            <div className="flex items-center justify-between mb-8">
              <Link href="/" onClick={closeMenu} className="flex items-center gap-2">
                <Image
                  src="/images/action-tokens-logo.jpg"
                  alt="Action Tokens"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold">Action Tokens</span>
              </Link>
              <button
                onClick={closeMenu}
                className="p-2 text-gray-300 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="space-y-4">
              <Link
                href="/"
                onClick={closeMenu}
                className="block py-2 text-gray-300 hover:text-white transition-colors"
              >
                Home
              </Link>

              <div className="flex items-center justify-between py-2 text-gray-300">
                <span>Theme</span>
                <ThemeToggle />
              </div>

              <div className="pt-4 border-t border-gray-800">
                <Link
                  href="https://app.action-tokens.com/"
                  onClick={closeMenu}
                  className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-2 rounded-full text-white font-semibold"
                >
                  <Rocket className="w-4 h-4" />
                  <span>Launch WebApp</span>
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
