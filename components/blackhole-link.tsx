"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

type BlackHoleLinkProps = {
  href?: string
  className?: string
  children: React.ReactNode
  /** Called right before navigation (e.g. to close a mobile menu). */
  onNavigate?: () => void
}

export function BlackHoleLink({ href = "/demolish", className, children, onNavigate }: BlackHoleLinkProps) {
  const router = useRouter()
  const [warping, setWarping] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Preload the destination so it's ready when the animation finishes.
    router.prefetch(href)
    return () => {
      timers.current.forEach(clearTimeout)
    }
  }, [href, router])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let modifier-clicks (open in new tab, etc.) behave normally.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      e.preventDefault()
      if (warping) return
      setWarping(true)

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

      const navDelay = reduce ? 350 : 1150
      const clearDelay = reduce ? 550 : 1650

      timers.current.push(
        setTimeout(() => {
          onNavigate?.()
          router.push(href)
        }, navDelay),
      )
      // Reset after navigation so the overlay doesn't linger on the new page.
      timers.current.push(setTimeout(() => setWarping(false), clearDelay))
    },
    [href, onNavigate, router, warping],
  )

  return (
    <>
      <Link href={href} onClick={handleClick} className={className}>
        {children}
      </Link>

      {warping && (
        <div className="bh-overlay" role="presentation" aria-hidden="true">
          <div className="bh-scene">
            <div className="bh-disk" />
            <div className="bh-disk bh-disk--rev" />
            <div className="bh-core" />
          </div>
          <div className="bh-flash" />
          <p className="bh-label">Entering the BlackHole</p>
          <span className="sr-only" role="status" aria-live="polite">
            Loading Stellar BlackHole
          </span>
        </div>
      )}
    </>
  )
}
