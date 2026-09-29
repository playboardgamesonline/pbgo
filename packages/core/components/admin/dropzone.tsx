"use client"

import { Delete02Icon, Upload04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef, useState } from "react"
import { Button } from "@pgo/ui/admin/button"
import { Spinner } from "@pgo/ui/admin/spinner"
import { cn } from "@pgo/ui/utils"

type Props = {
  accept: string
  title: string
  hint: string
  busy?: boolean
  disabled?: boolean
  size?: "lg" | "sm"
  current?: React.ReactNode
  onFile: (file: File) => void
  onRemove?: () => void
  removeLabel?: string
}

// Zone de dépôt : clic, glisser-déposer ou coller (⌘V) quand elle a le focus
export function Dropzone({ accept, title, hint, busy, disabled, size = "sm", current, onFile, onRemove, removeLabel = "Retirer" }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const inactive = disabled || busy

  function take(files: FileList | null | undefined) {
    const file = files?.[0]
    if (file && !inactive) onFile(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={inactive ? -1 : 0}
        aria-disabled={inactive}
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
          "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-muted/30 px-4 text-center transition-colors outline-none",
          "hover:border-ring/60 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
          size === "lg" ? "min-h-48 py-6" : "min-h-24 py-4",
          over && "border-ring bg-muted",
          inactive && "cursor-not-allowed opacity-60 hover:border-border hover:bg-muted/30",
        )}
      >
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => (take(e.target.files), (e.target.value = ""))} />
        {current ?? (
          <span className="flex size-10 items-center justify-center rounded-full bg-background shadow-xs ring-1 ring-border">
            {busy ? <Spinner /> : <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} className="size-4" />}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">{busy ? "Envoi en cours…" : title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {onRemove && (
        <Button variant="ghost" size="sm" className="self-start" disabled={inactive} onClick={onRemove}>
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
          {removeLabel}
        </Button>
      )}
    </div>
  )
}
