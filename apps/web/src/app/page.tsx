import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl tracking-wide text-primary">Courtisans</h1>
      <Button>Créer une partie</Button>
    </main>
  )
}
