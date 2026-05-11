export type StackrayReleaseMetadata = {
  version: string
  title: string | null
  body: string | null
  url: string | null
  publishedAt: string | null
}

export type StackrayUpdateStatus = {
  updateAvailable: boolean
  fingerprint: string
  currentVersion: string
  latestVersion: string
  latestUrl: string | null
  latestRelease: StackrayReleaseMetadata | null
  checkedAt: string
}
