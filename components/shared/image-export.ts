export const imageExportOptions = {
  cacheBust: true,
  includeQueryParams: true,
  pixelRatio: 2,
  backgroundColor: "transparent",
}

export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

export function resolveExportImageSrc(src: string | null): string | null {
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

export function getDomainFaviconSrc(target: string) {
  const domain = target
    .replace(/^https?:\/\//i, "")
    .split("/", 1)[0]
    ?.trim()

  if (!domain) {
    return null
  }

  return `https://www.google.com/s2/favicons?${new URLSearchParams({
    domain,
    sz: "128",
  }).toString()}`
}

export function resolveExportFaviconSrc(target: string): string | null {
  return resolveExportImageSrc(getDomainFaviconSrc(target))
}

export async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"))

  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      let timeoutId: number | null = null
      const finish = () => {
        image.removeEventListener("load", finish)
        image.removeEventListener("error", finish)

        if (timeoutId !== null) {
          window.clearTimeout(timeoutId)
        }

        resolve()
      }

      image.addEventListener("load", finish, { once: true })
      image.addEventListener("error", finish, { once: true })
      timeoutId = window.setTimeout(finish, 1500)
    })
  }))
}
