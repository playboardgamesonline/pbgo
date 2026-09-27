"use client"

import { Volume2Icon, VolumeXIcon } from "lucide-react"
import { useSyncExternalStore } from "react"
import { BOUTON_ICONE } from "@/components/regles"
import { Button } from "@/components/ui/button"

const CLE = "courtisans:son"
const abonnes = new Set<() => void>()

function lire() {
  try {
    return localStorage.getItem(CLE) !== "off"
  } catch {
    return true
  }
}

export function setSonActif(actif: boolean) {
  try {
    localStorage.setItem(CLE, actif ? "on" : "off")
  } catch {}
  abonnes.forEach((f) => f())
}

export function useSonActif() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    lire,
    () => true,
  )
}

export function BoutonSon() {
  const actif = useSonActif()
  const Icone = actif ? Volume2Icon : VolumeXIcon
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={actif ? "Couper le son" : "Activer le son"}
      title={actif ? "Couper le son" : "Activer le son"}
      className={BOUTON_ICONE}
      onClick={() => setSonActif(!actif)}
    >
      <Icone strokeWidth={1.5} className="size-5" />
    </Button>
  )
}
