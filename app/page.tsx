import Image from "next/image";

export default function Home() {
  return (
    <main className="home">
      <div className="sky" aria-hidden="true" />
      <div className="content">
        <h1 className="logo">
          <Image src="/logo.png" alt="Hanabi" width={1200} height={358} priority />
        </h1>
        <p className="status">
          <span className="dot" aria-hidden="true" />
          Jeu en cours de développement…
        </p>
        <p className="credits">Un jeu d&apos;Antoine Bauza · Bientôt jouable en ligne</p>
      </div>
    </main>
  );
}
