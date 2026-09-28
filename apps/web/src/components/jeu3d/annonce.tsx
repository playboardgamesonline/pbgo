"use client"

import { motion } from "motion/react"
import { useEffect } from "react"
import { jouerSon, type NomSon } from "@/lib/son"

function Ligne({ sens }: { sens: 1 | -1 }) {
  return (
    <div className="relative h-[3px] w-full overflow-hidden">
      <motion.div
        className="absolute inset-y-0 w-[70%]"
        style={{ background: "linear-gradient(90deg, transparent, #f5c542 30%, #fff4d6 50%, #f5c542 70%, transparent)" }}
        initial={{ x: sens === 1 ? "-100%" : "145%" }}
        animate={{ x: sens === 1 ? "145%" : "-100%" }}
        transition={{ duration: 2.6, ease: [0.45, 0, 0.2, 1] }}
      />
    </div>
  )
}

export function Annonce({ texte, son }: { texte: string; son: NomSon }) {
  useEffect(() => {
    jouerSon(son)
  }, [son])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/30"
    >
      <div className="flex w-full flex-col items-center gap-6">
        <Ligne sens={1} />
        <motion.h2
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.1 }}
          className="px-6 text-center font-typey text-5xl tracking-[0.06em] text-white uppercase md:text-7xl"
          style={{
            WebkitTextStroke: "3px #f2b705",
            paintOrder: "stroke fill",
            filter: "drop-shadow(0 4px 0 rgb(0 0 0 / 85%)) drop-shadow(0 10px 18px rgb(0 0 0 / 60%))",
          }}
        >
          {texte}
        </motion.h2>
        <Ligne sens={-1} />
      </div>
    </motion.div>
  )
}
