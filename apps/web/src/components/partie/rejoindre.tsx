"use client"

import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { ChateauPicker } from "@/components/chateau"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ChateauOption } from "@/lib/catalogue"
import type { Profil } from "@/lib/profil"

export function RejoindreFormulaire({
  code,
  chateaux,
  profil,
  setProfil,
  onRejoindre,
}: {
  code: string
  chateaux: ChateauOption[]
  profil: Profil
  setProfil: (p: Partial<Profil>) => void
  onRejoindre: () => Promise<void>
}) {
  const [enCours, setEnCours] = useState(false)
  return (
    <form
      className="w-full max-w-md space-y-6 rounded-2xl border bg-card/80 p-6 shadow-2xl backdrop-blur"
      onSubmit={async (e) => {
        e.preventDefault()
        setEnCours(true)
        await onRejoindre().finally(() => setEnCours(false))
      }}
    >
      <div className="text-center">
        <p className="text-muted-foreground">Tu es invité à la partie</p>
        <p className="font-display text-3xl tracking-[0.3em] text-primary">{code}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pseudo">Ton pseudonyme</Label>
        <Input id="pseudo" value={profil.pseudo} maxLength={20} onChange={(e) => setProfil({ pseudo: e.target.value })} className="h-11 text-base" />
      </div>
      <div className="space-y-2">
        <Label>Ton château</Label>
        <ChateauPicker chateaux={chateaux} value={profil.chateau} onChange={(chateau) => setProfil({ chateau })} />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full font-display text-base" disabled={enCours || !profil.pseudo.trim()}>
        {enCours && <Loader2Icon className="animate-spin" />}
        Rejoindre la partie
      </Button>
    </form>
  )
}
