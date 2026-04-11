import type { RunsRowCreatedBy } from "@/components/runs/types"

export interface RunsRowEnrichment {
  createdBy: RunsRowCreatedBy
  hiddenTargets: readonly string[]
  topTechnologies: readonly string[]
}
