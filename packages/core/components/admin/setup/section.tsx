"use client"

import { Delete02Icon, RotateLeft01Icon, Upload04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@pbgo/ui/admin/alert"
import { Badge } from "@pbgo/ui/admin/badge"
import { Button } from "@pbgo/ui/admin/button"
import { Spinner } from "@pbgo/ui/admin/spinner"
import { cn } from "@pbgo/ui/utils"
import { adminRequest } from "../../../lib/admin-api"
import type { AdminData, SectionName } from "../../../server/settings"
import { useDirtyGuard } from "../admin-shell"

export type { AdminData }

/**
 * État d'une page Setup : brouillon, enregistrement (bouton flottant, ⌘S), envoi de fichiers.
 * Les fichiers sont enregistrés tout de suite ; le reste attend « Save ».
 */
export function useSection<T>(section: SectionName, initial: AdminData, pick: (d: AdminData) => T) {
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [saved, setSaved] = useState(() => pick(initial))
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])
  useDirtyGuard(dirty)

  function apply(next: AdminData, keepDraft: boolean) {
    setData(next)
    const fresh = pick(next)
    setSaved(fresh)
    if (!keepDraft) setDraft(fresh)
    setVersion((v) => v + 1)
    router.refresh()
  }

  async function save() {
    if (!dirty || saving || !data.writable) return
    setSaving(true)
    try {
      apply(await adminRequest<AdminData>("/api/admin/settings", { method: "PUT", body: JSON.stringify({ section, values: draft }) }), false)
      toast.success("Saved")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function upload(slot: string, file: File) {
    const form = new FormData()
    form.append("file", file)
    setUploading(slot)
    try {
      apply(await adminRequest<AdminData>(`/api/admin/upload/${encodeURIComponent(slot)}`, { method: "POST", body: form }), true)
      toast.success(`${file.name} uploaded`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  async function remove(slot: string) {
    setUploading(slot)
    try {
      apply(await adminRequest<AdminData>(`/api/admin/upload/${encodeURIComponent(slot)}`, { method: "DELETE" }), true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault()
      void saveRef.current()
    }
  }, [])
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey])

  return {
    data,
    setData: (next: AdminData) => apply(next, true),
    draft,
    setDraft,
    set: <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => ({ ...d, [key]: value })),
    dirty,
    saving,
    save,
    reset: () => setDraft(saved),
    upload,
    remove,
    uploading,
    version,
    disabled: !data.writable,
  }
}

export function SaveBar({ dirty, saving, disabled, onSave, onReset }: { dirty: boolean; saving: boolean; disabled: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          role="region"
          aria-label="Unsaved changes"
          initial={{ opacity: 0, y: 24, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 24, x: "-50%" }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed bottom-6 left-[calc(50%+7.5rem)] z-40 flex items-center gap-3 rounded-full border bg-background/90 py-2 pr-2 pl-4 shadow-lg ring-1 ring-black/5 backdrop-blur"
        >
          <Badge variant="secondary">Unsaved changes</Badge>
          <span className="hidden text-xs text-muted-foreground sm:inline">⌘S to save</span>
          <Button variant="ghost" onClick={onReset} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={disabled || saving}>
            {saving && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ReadOnlyAlert({ writable }: { writable: boolean }) {
  if (writable) return null
  return (
    <Alert>
      <AlertTitle>Read only</AlertTitle>
      <AlertDescription>Add a Sanity token with Editor rights in SANITY_API_WRITE_TOKEN to save from the admin. The values shown are the defaults from the code.</AlertDescription>
    </Alert>
  )
}

/** Deux colonnes : réglages à gauche, aperçus collants à droite. */
export function SetupLayout({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className={cn("grid gap-6 pb-24", aside && "xl:grid-cols-[minmax(0,1fr)_26rem]")}>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
      {aside && <aside className="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">{aside}</aside>}
    </div>
  )
}

/**
 * Fichier (image, police, PDF, son) : clic, glisser-déposer ou coller. `custom` = envoyé dans Sanity ;
 * sinon la valeur par défaut du jeu est affichée avec un badge « Default ».
 */
export function FileTile({
  accept,
  label,
  hint,
  preview,
  custom,
  busy,
  disabled,
  onFile,
  onRemove,
  className,
  aspect = "aspect-[16/7]",
  checker = true,
  showDefault = true,
}: {
  accept: string
  label: string
  hint?: string
  preview?: React.ReactNode
  custom: boolean
  busy?: boolean
  disabled?: boolean
  onFile: (f: File) => void
  onRemove?: () => void
  className?: string
  aspect?: string
  checker?: boolean
  /** Badge « Default » quand rien n'est envoyé (images) ; inutile pour polices et PDF */
  showDefault?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const inactive = disabled || busy
  const take = (files: FileList | null | undefined) => {
    const f = files?.[0]
    if (f && !inactive) onFile(f)
  }
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {custom ? (
          onRemove && (
            <button
              type="button"
              disabled={inactive}
              onClick={onRemove}
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="Remove and use the default"
            >
              <HugeiconsIcon icon={preview ? RotateLeft01Icon : Delete02Icon} strokeWidth={2} className="size-3" />
              Reset
            </button>
          )
        ) : (
          preview && showDefault && <Badge variant="outline" className="text-[10px]">Default</Badge>
        )}
      </div>
      <div
        role="button"
        tabIndex={inactive ? -1 : 0}
        aria-label={`Replace ${label}`}
        onClick={() => !inactive && input.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !inactive) {
            e.preventDefault()
            input.current?.click()
          }
        }}
        onPaste={(e) => {
          if (e.clipboardData.files.length) {
            e.preventDefault()
            take(e.clipboardData.files)
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!inactive) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          take(e.dataTransfer.files)
        }}
        className={cn(
          "group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-muted/40 outline-none transition-colors",
          "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          checker && "bg-[conic-gradient(#0000000a_25%,transparent_0_50%,#0000000a_0_75%,transparent_0)] bg-[length:16px_16px]",
          aspect,
          over && "border-ring bg-muted",
          inactive && "cursor-not-allowed opacity-60",
        )}
      >
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => (take(e.target.files), (e.target.value = ""))} />
        {preview ?? (
          <span className="flex size-9 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border">
            <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} className="size-4" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs font-medium opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
          {busy ? <Spinner /> : preview ? "Replace" : "Upload"}
        </span>
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Spinner />
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
export const IMAGE_HINT = "PNG, JPG, WebP or SVG · converted to WebP · 4 MB max"

export function Img({ src, className }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={cn("max-h-full max-w-full object-contain", className)} />
}
