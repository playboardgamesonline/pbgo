import Image from "next/image";
import { site } from "./site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      description: site.description,
      inLanguage: "fr-FR",
    },
    {
      "@type": "VideoGame",
      "@id": `${site.url}/#game`,
      name: "Hanabi",
      url: site.url,
      description: site.description,
      image: `${site.url}/opengraph-image.png`,
      inLanguage: "fr-FR",
      genre: ["Jeu de cartes", "Jeu coopératif"],
      gamePlatform: "Navigateur web",
      applicationCategory: "Game",
      playMode: "CoOp",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5 },
      typicalAgeRange: "10-",
      author: { "@type": "Person", name: "Antoine Bauza" },
    },
  ],
};

export default function Home() {
  return (
    <main className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="sky" aria-hidden="true" />
      <div className="content">
        <h1 className="logo">
          <Image src="/logo.png" alt="Hanabi en ligne" width={1200} height={358} priority />
        </h1>
        <p className="status">
          <span className="dot" aria-hidden="true" />
          Jeu en cours de développement…
        </p>
        <p className="credits">
          Le jeu coopératif de feux d&apos;artifice d&apos;Antoine Bauza · Bientôt jouable en ligne
        </p>
      </div>
    </main>
  );
}
