import { PreviewPage, previewMetadata } from "@pbgo/core/pages/preview"
import { playableGameOf } from "@/lib/game"

export const dynamic = "force-dynamic"

export const metadata = previewMetadata

export default async function Preview({ params }: PageProps<"/[game]/preview/[kind]">) {
  return <PreviewPage game={await playableGameOf(params)} kind={(await params).kind} />
}
