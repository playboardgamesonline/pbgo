"use client"

import { useAnimate } from "motion/react"
import { useLayoutEffect } from "react"
import { useJeu } from "./contexte"

export function Arrivee({ origine, children, className, style }: { origine: string | null; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const { rect } = useJeu()

  useLayoutEffect(() => {
    if (!origine || !scope.current) return
    const depart = rect(origine)
    if (!depart) return
    const arrivee = scope.current.getBoundingClientRect()
    const dx = depart.left + depart.width / 2 - (arrivee.left + arrivee.width / 2)
    const dy = depart.top + depart.height / 2 - (arrivee.top + arrivee.height / 2)
    animate(
      scope.current,
      { x: [dx, 0], y: [dy, 0], scale: [0.35, 1], rotate: [-12, 0], opacity: [0, 1] },
      { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={scope} className={className} style={style}>
      {children}
    </div>
  )
}
