import { PreviewPage, previewMetadata } from "@pbgo/core/pages/preview"
import { previewableGameOf } from "@/lib/game"

export const dynamic = "force-dynamic"

export const metadata = previewMetadata

export default async function Preview({ params }: PageProps<"/[game]/preview/[kind]">) {
  return <PreviewPage game={await previewableGameOf(params)} kind={(await params).kind} />
}
