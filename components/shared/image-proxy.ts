export function resolveImageProxySrc(src: string | null): string | null {
  if (!src) {
    return null
  }

  if (src.startsWith("//")) {
    return `/api/v1/image-proxy?${new URLSearchParams({ url: `https:${src}` }).toString()}`
  }

  if (src.startsWith("/") || src.startsWith("data:")) {
    return src
  }

  if (/^https?:\/\//i.test(src)) {
    return `/api/v1/image-proxy?${new URLSearchParams({ url: src }).toString()}`
  }

  return null
}
