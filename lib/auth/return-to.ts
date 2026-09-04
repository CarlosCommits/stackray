const DEFAULT_SIGN_IN_DESTINATION = "/dashboard"

const RETURN_TO_BASE_URL = "https://stackray.invalid"

export function getSafeReturnTo(value: string | null | undefined) {
  const candidate = value?.trim()

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_SIGN_IN_DESTINATION
  }

  try {
    const url = new URL(candidate, RETURN_TO_BASE_URL)

    if (url.origin !== RETURN_TO_BASE_URL) {
      return DEFAULT_SIGN_IN_DESTINATION
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_SIGN_IN_DESTINATION
  }
}

export function buildSignInHref(value: string | null | undefined) {
  const returnTo = getSafeReturnTo(value)

  if (returnTo === DEFAULT_SIGN_IN_DESTINATION) {
    return "/"
  }

  return `/?${new URLSearchParams({ returnTo }).toString()}`
}
