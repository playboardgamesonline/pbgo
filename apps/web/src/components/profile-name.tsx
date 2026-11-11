"use client"

import type { ClipboardEvent } from "react"
import { cn } from "@pbgo/ui/utils"

/**
 * The name at the head of a profile. The tag is not drawn, since a name is what a profile is known by; it is what is copied: the whole name selected and copied is the handle, `Alex#0042`, which is how a member is told apart from another of the same name
 * (PLT-39). A part of the name selected is copied as it is. The name can be selected, which the rest of the platform's text cannot.
 */
export function ProfileName({ nickname, tag, className }: { nickname: string; tag: string | null; className?: string }) {
  const copy = (event: ClipboardEvent<HTMLHeadingElement>) => {
    if (tag === null || window.getSelection()?.toString().trim() !== nickname) return
    event.clipboardData.setData("text/plain", `${nickname}#${tag}`)
    event.preventDefault()
  }
  return (
    <h1 data-selectable onCopy={copy} className={cn("ph-mask", className)}>
      {nickname}
    </h1>
  )
}
