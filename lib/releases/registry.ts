interface ReleaseEntry {
  version: string
  title: string
  summary: string[]
}

const releaseRegistry: ReleaseEntry[] = [
  {
    version: "0.1.0",
    title: "First-admin bootstrap and guided tours",
    summary: [
      "Added a dedicated bootstrap flow for deployers to create the first admin account.",
      "Added per-user product tours for the dashboard, tokens, and users pages.",
      "Added one-time in-app release notices so users can see what changed after upgrades.",
    ],
  },
]

export function getReleaseByVersion(version: string) {
  return releaseRegistry.find((entry) => entry.version === version)
}
