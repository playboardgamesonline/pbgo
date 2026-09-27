import { PartieClient } from "@/components/partie/partie-client"
import { getCatalogueClient } from "@/sanity/catalogue-client"

export default async function PartiePage({ params }: PageProps<"/partie/[code]">) {
  const { code } = await params
  return <PartieClient code={code.toUpperCase()} catalogue={await getCatalogueClient()} />
}
