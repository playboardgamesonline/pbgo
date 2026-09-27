import { Accueil } from "@/components/accueil/accueil"
import { getCatalogueClient } from "@/sanity/catalogue-client"

export const revalidate = 60

export default async function Home() {
  return <Accueil catalogue={await getCatalogueClient()} />
}
