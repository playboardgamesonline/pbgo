import { AdminPage, adminMetadata } from "@pbgo/core/pages/admin"
import { GAMES } from "@pbgo/games"
import { playableGameOf } from "@/lib/game"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: PageProps<"/[game]/admin/[[...section]]">) {
  return adminMetadata((await params).section)
}

export default async function Admin({ params }: PageProps<"/[game]/admin/[[...section]]">) {
  return <AdminPage game={await playableGameOf(params)} section={(await params).section} games={GAMES} />
}
