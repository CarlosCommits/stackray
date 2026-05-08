export type StackrayUpdateStatus = {
  updateAvailable: boolean
  fingerprint: string
  currentVersion: string
  latestVersion: string
  latestUrl: string | null
  checkedAt: string
}
