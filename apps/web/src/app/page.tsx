import { Accueil } from "@/components/accueil/accueil"
import { DESCRIPTION, SITE_URL, TITRE } from "@/lib/site"
import { getCatalogueClient } from "@/sanity/catalogue-client"

export const revalidate = 60

const DONNEES_STRUCTUREES = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: "Courtisans", inLanguage: "fr-FR", description: DESCRIPTION },
    {
      "@type": "VideoGame",
      name: "Courtisans",
      alternateName: TITRE,
      url: SITE_URL,
      description: DESCRIPTION,
      inLanguage: "fr-FR",
      genre: ["Jeu de cartes", "Jeu de société", "Jeu de bluff"],
      gamePlatform: "Navigateur web",
      applicationCategory: "Game",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5 },
      image: `${SITE_URL}/opengraph-image.jpg`,
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
      author: { "@type": "Person", name: "oré", url: "https://ore.today" },
    },
  ],
}

export default async function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DONNEES_STRUCTUREES) }} />
      <h1 className="sr-only">{TITRE} : jouez à Courtisans en ligne avec vos amis</h1>
      <Accueil catalogue={await getCatalogueClient()} />
    </>
  )
}
