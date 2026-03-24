import { NewScanForm } from "@/components/scans"

interface NewScanPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NewScanPage({ searchParams }: NewScanPageProps) {
  const params = await searchParams
  const target = typeof params.target === "string" ? params.target : undefined

  return <NewScanForm initialTarget={target} />
}
