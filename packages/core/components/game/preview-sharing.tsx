"use client"

import { CopyIcon, DownloadIcon, Share2Icon } from "lucide-react"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@pbgo/ui/game/dialog"
import { useSiteSettings } from "../settings-provider"
import { copyImage, shareFile, canShare, downloadFile } from "./sharing"

const BUTTON =
  "inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl px-6 font-display text-lg tracking-wide transition-transform duration-200 hover:scale-[1.04] active:scale-[0.98]"
const WHITE = "bg-foreground text-background shadow-[0_10px_30px_rgb(0_0_0/55%)]"
const OUTLINE = "border border-foreground/60 text-foreground hover:bg-foreground/10"

export function SharePreview({ file, text, onClose }: { file: File | null; text: string; onClose: () => void }) {
  const { title } = useSiteSettings()
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const native = !!file && canShare(file)
  const copyable = typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write

  async function copy() {
    if (!file) return
    try {
      await copyImage(file)
      toast.success("Image copiée, il ne reste plus qu'à la coller")
    } catch {
      toast.error("Impossible de copier l'image")
    }
  }

  async function share() {
    if (!file) return
    try {
      await shareFile(file, text, title)
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Impossible de partager l'image")
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[min(94vw,56rem)] max-w-none gap-5 rounded-2xl border border-accent-game/50 bg-surface-dark p-6 text-foreground sm:max-w-none">
        <div>
          <DialogTitle className="font-display text-2xl tracking-wide">Partager le résultat</DialogTitle>
          <DialogDescription className="mt-1 text-foreground/65">{text}</DialogDescription>
        </div>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Résultat de la partie" className="w-full rounded-xl border border-foreground/15 shadow-[0_12px_40px_rgb(0_0_0/50%)]" />
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {native && (
            <button type="button" onClick={share} className={`${BUTTON} ${WHITE}`}>
              <Share2Icon className="size-4" />
              Partager
            </button>
          )}
          {copyable && (
            <button type="button" onClick={copy} className={`${BUTTON} ${OUTLINE}`}>
              <CopyIcon className="size-4" />
              Copier l&apos;image
            </button>
          )}
          <button
            type="button"
            onClick={() => file && downloadFile(file)}
            className={`${BUTTON} ${native ? OUTLINE : WHITE}`}
          >
            <DownloadIcon className="size-4" />
            Télécharger
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
