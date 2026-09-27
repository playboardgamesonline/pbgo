"use client"

import { Loader2Icon } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import type { PartiePublique } from "@/lib/partie-types"
import { useJeu } from "./contexte"
import { CarteMission } from "./mission"

export function MissionsIntro({ onMaj }: { onMaj: (p: PartiePublique) => void }) {
  const { vue, partie } = useJeu()
  const [envoi, setEnvoi] = useState(false)
  const moi = vue.joueurs.find((j) => j.id === vue.moi?.id)
  if (vue.phase !== "missions" || !vue.moi || !moi) return null
  const lues = vue.joueurs.filter((j) => j.missionsLues).length

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-background/90 p-6 backdrop-blur-md">
      <div className="text-center">
        <h2 className="font-display text-3xl text-primary">Tes missions secrètes</h2>
        <p className="text-muted-foreground">Garde-les pour toi : elles rapportent 3 points chacune en fin de partie.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        {vue.moi.missions.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 40, rotateY: 90 }} animate={{ opacity: 1, y: 0, rotateY: 0 }} transition={{ delay: 0.2 + i * 0.25, type: "spring", damping: 16 }}>
            <CarteMission mission={m} className="w-80" />
          </motion.div>
        ))}
      </div>
      {moi.missionsLues ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          En attente des autres joueurs ({lues}/{vue.joueurs.length})
        </p>
      ) : (
        <Button
          size="lg"
          className="h-12 px-8 font-display text-base"
          disabled={envoi}
          onClick={async () => {
            setEnvoi(true)
            try {
              onMaj(await api.action(partie.code, { type: "lireMissions" }))
            } catch (e) {
              toast.error((e as Error).message)
            } finally {
              setEnvoi(false)
            }
          }}
        >
          {envoi && <Loader2Icon className="animate-spin" />}
          J&apos;ai lu mes missions
        </Button>
      )}
    </motion.div>
  )
}
