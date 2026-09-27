"use client"

import { LocateFixedIcon } from "lucide-react"
import { BOUTON_ICONE } from "@/components/regles"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { recentrerCamera, useCameraDeplacee } from "./camera"

export function BoutonRecentrer() {
  const deplacee = useCameraDeplacee()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Recentrer la vue"
      title="Recentrer la vue (double-clic)"
      className={cn(BOUTON_ICONE, "transition-all duration-300", !deplacee && "pointer-events-none scale-75 opacity-0")}
      onClick={recentrerCamera}
    >
      <LocateFixedIcon strokeWidth={1.5} className="size-5" />
    </Button>
  )
}
