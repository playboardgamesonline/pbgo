import type { Metadata } from "next"
import { PartieClient } from "@/components/partie/partie-client"
import { getCatalogueClient } from "@/sanity/catalogue-client"

export async function generateMetadata({ params }: PageProps<"/partie/[code]">): Promise<Metadata> {
  const { code } = await params
  return { title: `[${code.toUpperCase()}]`, robots: { index: false, follow: true } }
}

export default async function PartiePage({ params }: PageProps<"/partie/[code]">) {
  const { code } = await params
  return <PartieClient code={code.toUpperCase()} catalogue={await getCatalogueClient()} />
}
