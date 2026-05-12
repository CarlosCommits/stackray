import type { Metadata } from "next"

import { NewScanForm } from "@/components/scans"

export const metadata: Metadata = {
  title: "New scan | Stackray",
  description: "Start a new Stackray site intelligence scan.",
}

interface NewScanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewScanPage({ searchParams }: NewScanPageProps) {
  const params = await searchParams
  const target = typeof params.target === "string" ? params.target : undefined

  return <NewScanForm initialTarget={target} />
}
