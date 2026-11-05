"use client"

import { LinkPreview, TabPreview } from "./preview"

export function LinkPreviewAside({
  share,
  tab,
}: {
  share: { image: string; title: string; description: string; domain: string }
  tab?: { title: string; favicon: string | null }
}) {
  return (
    <>
      {tab && <TabPreview {...tab} />}
      <LinkPreview {...share} />
    </>
  )
}
