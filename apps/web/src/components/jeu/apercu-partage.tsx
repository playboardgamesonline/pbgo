"use client"

import { CopyIcon, DownloadIcon, Share2Icon } from "lucide-react"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { copierImage, partagerFichier, peutPartager, telechargerFichier } from "./partage"

const BOUTON =
  "inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl px-6 font-display text-lg tracking-wide transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
const BLANC = "bg-foreground text-[#0b2231] shadow-[0_10px_30px_rgb(0_0_0/55%),0_0_28px_rgb(240_233_206/30%)]"
const CONTOUR = "border border-foreground/60 text-foreground hover:bg-foreground/10"

export function ApercuPartage({ fichier, texte, onFermer }: { fichier: File | null; texte: string; onFermer: () => void }) {
  const url = useMemo(() => (fichier ? URL.createObjectURL(fichier) : null), [fichier])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const natif = !!fichier && peutPartager(fichier)
  const copiable = typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write

  async function copier() {
    if (!fichier) return
    try {
      await copierImage(fichier)
      toast.success("Image copiée, il ne reste plus qu'à la coller")
    } catch {
      toast.error("Impossible de copier l'image")
    }
  }

  async function partager() {
    if (!fichier) return
    try {
      await partagerFichier(fichier, texte)
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Impossible de partager l'image")
    }
  }

  return (
    <Dialog open={!!fichier} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent className="w-[min(94vw,56rem)] max-w-none gap-5 rounded-2xl border border-[#8a6a3a]/60 bg-[#0b2231] p-6 text-foreground sm:max-w-none">
        <div>
          <DialogTitle className="font-display text-2xl tracking-wide">Partager le résultat</DialogTitle>
          <DialogDescription className="mt-1 text-foreground/65">{texte}</DialogDescription>
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Résultat du banquet" className="w-full rounded-xl border border-[#f3ecd6]/15 shadow-[0_12px_40px_rgb(0_0_0/50%)]" />
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {natif && (
            <button type="button" onClick={partager} className={`${BOUTON} ${BLANC}`}>
              <Share2Icon className="size-4" />
              Partager
            </button>
          )}
          {copiable && (
            <button type="button" onClick={copier} className={`${BOUTON} ${CONTOUR}`}>
              <CopyIcon className="size-4" />
              Copier l&apos;image
            </button>
          )}
          <button
            type="button"
            onClick={() => fichier && telechargerFichier(fichier)}
            className={`${BOUTON} ${natif ? CONTOUR : BLANC}`}
          >
            <DownloadIcon className="size-4" />
            Télécharger
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
