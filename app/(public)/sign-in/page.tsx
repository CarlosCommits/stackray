import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Sign in | Stackray",
  description: "Sign in to Stackray to run scans and inspect site intelligence.",
}

export default function SignInRedirectPage() {
  redirect("/")
}
