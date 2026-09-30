"use client"

import type { PreviewDraft } from "../../../lib/preview"
import { LinkPreview, PreviewCard } from "./preview"

export function LinkPreviewAside({ draft, share }: { draft: PreviewDraft; share: { image: string; title: string; description: string; domain: string } }) {
  return (
    <>
      <PreviewCard draft={draft} />
      <LinkPreview {...share} />
    </>
  )
}
