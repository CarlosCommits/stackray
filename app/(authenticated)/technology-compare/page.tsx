import type { Metadata } from "next"

import { TechnologyCompareClient } from "@/components/technology-compare"

export const metadata: Metadata = {
  title: "Technology Comparison | Stackray",
  description: "Select technologies, compare matching sites, and export a shareable Stackray view.",
}

interface TechnologyComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TechnologyComparePage({ searchParams }: TechnologyComparePageProps) {
  const params = await searchParams
  const technologies = Array.isArray(params.technology)
    ? params.technology
    : params.technology
      ? [params.technology]
      : []

  return <TechnologyCompareClient initialTechnologies={technologies} />
}
