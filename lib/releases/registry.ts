export interface ReleaseEntry {
  version: string
  title: string
  summary: string[]
}

export const releaseRegistry: ReleaseEntry[] = [
  {
    version: "0.1.0",
    title: "First-run onboarding and guided setup",
    summary: [
      "Added a dedicated setup flow for deployers with public URL confirmation and guided next steps.",
      "Added deployer checklists and per-user product tours for the dashboard, tokens, and users pages.",
      "Added one-time in-app release notices so users can see what changed after upgrades.",
    ],
  },
]

export function getReleaseByVersion(version: string) {
  return releaseRegistry.find((entry) => entry.version === version)
}
