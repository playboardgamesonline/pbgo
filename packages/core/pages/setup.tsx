import { redirect } from "next/navigation"

/** Ancienne adresse de l'admin. */
export default function SetupPage() {
  redirect("/admin/identity")
}
