"use client"

import type { PreviewDraft } from "../../../lib/preview"
import { LinkPreview, PreviewCard, TabPreview } from "./preview"

export function LinkPreviewAside({
  draft,
  share,
  tab,
}: {
  draft: PreviewDraft
  share: { image: string; title: string; description: string; domain: string }
  tab?: { title: string; favicon: string | null }
}) {
  return (
    <>
      <PreviewCard draft={draft} />
      {tab && <TabPreview {...tab} />}
      <LinkPreview {...share} />
    </>
  )
}
