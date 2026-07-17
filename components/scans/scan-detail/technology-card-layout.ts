export type TechnologyCardDensity = "sparse" | "roomy" | "dense" | "packed"

export type TechnologyCardMode = "profile" | "inventory"

export type TechnologyCardIconScale = {
  readonly shellClass: string
  readonly imageClass: string
  readonly imageSize: number
  readonly fallbackClass: string
}

export type TechnologyCardFrameDimensions = {
  readonly width: number
  readonly height: number
}

export type TechnologyCardLayout = {
  readonly density: TechnologyCardDensity
  readonly mode: TechnologyCardMode
  readonly gridColsClass: string
  readonly groupGridClass: string
  readonly groupPaddingClass: string
  readonly itemPaddingClass: string
  readonly itemGapClass: string
  readonly iconScale: TechnologyCardIconScale
  readonly titleSizeClass: string
  readonly headerCompact: boolean
  readonly headerTitleSizeClass: string
}

type IconScaleKey = "hero" | "xlarge" | "large" | "mediumLarge" | "medium" | "compact"

const iconScales: Record<IconScaleKey, TechnologyCardIconScale> = {
  hero: { shellClass: "size-16 rounded-2xl", imageClass: "size-12", imageSize: 48, fallbackClass: "size-8" },
  xlarge: { shellClass: "size-14 rounded-2xl", imageClass: "size-10", imageSize: 40, fallbackClass: "size-7" },
  large: { shellClass: "size-12 rounded-xl", imageClass: "size-9", imageSize: 36, fallbackClass: "size-6" },
  mediumLarge: { shellClass: "size-11 rounded-xl", imageClass: "size-8", imageSize: 32, fallbackClass: "size-6" },
  medium: { shellClass: "size-10 rounded-xl", imageClass: "size-7", imageSize: 28, fallbackClass: "size-5" },
  compact: { shellClass: "size-9 rounded-lg", imageClass: "size-6", imageSize: 24, fallbackClass: "size-5" },
}

export const portraitFixedFrameWidth = 1080
export const technologyCardProfileHeight = 1350
export const technologyCardStackProfileHeight = 1080

// Scan screenshots are captured by httpx at a fixed 1024x640 viewport (16:10).
const SCREENSHOT_FRAME_WIDTH = 1024
const SCREENSHOT_FRAME_HEIGHT = 640
// Fixed export frames use p-12 (48px) padding and a 1px border on every side.
const FIXED_FRAME_HORIZONTAL_INSET = 98

export function getScreenshotBrowserHeightPx(frameWidth: number): number {
  const innerWidth = frameWidth - FIXED_FRAME_HORIZONTAL_INSET
  return Math.round((innerWidth * SCREENSHOT_FRAME_HEIGHT) / SCREENSHOT_FRAME_WIDTH)
}

function getTechnologyCardColumns(count: number): number {
  if (count <= 1) return 1
  if (count <= 8) return 2
  if (count <= 30) return 3
  return 4
}

function getTechnologyCardDensity(count: number): TechnologyCardDensity {
  if (count <= 4) return "sparse"
  if (count <= 8) return "roomy"
  if (count <= 16) return "dense"
  return "packed"
}

function getInventoryFrameHeight(count: number, hasScreenshot: boolean, hasBrandFooter: boolean): number {
  const columns = getTechnologyCardColumns(count)
  const rows = Math.max(1, Math.ceil(count / columns))
  const screenshotHeight = hasScreenshot ? getScreenshotBrowserHeightPx(portraitFixedFrameWidth) + 32 : 0
  const brandHeight = hasBrandFooter ? 52 : 0
  const estimatedLedgerHeight = 128 + rows * (count > 30 ? 52 : 64)

  return Math.max(1080, 96 + 124 + screenshotHeight + estimatedLedgerHeight + brandHeight)
}

export function getTechnologyCardFixedFrameDimensions(
  count: number,
  hasScreenshot = false,
  hasBrandFooter = false,
): TechnologyCardFrameDimensions {
  const height = count <= 8
    ? hasScreenshot ? technologyCardProfileHeight : technologyCardStackProfileHeight
    : getInventoryFrameHeight(count, hasScreenshot, hasBrandFooter)

  return { width: portraitFixedFrameWidth, height }
}

const gridColsClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

export function getTechnologyCardLayout(count: number): TechnologyCardLayout {
  const columns = getTechnologyCardColumns(count)
  const density = getTechnologyCardDensity(count)
  const mode: TechnologyCardMode = count <= 8 ? "profile" : "inventory"

  if (count <= 1) {
    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: "py-5",
      itemPaddingClass: "py-4",
      itemGapClass: "gap-5",
      iconScale: iconScales.hero,
      titleSizeClass: "text-4xl",
      headerCompact: false,
      headerTitleSizeClass: "text-[54px]",
    }
  }

  if (count <= 4) {
    const isFourItemProfile = count === 4

    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: isFourItemProfile ? "py-2" : "py-4",
      itemPaddingClass: isFourItemProfile ? "py-2" : "py-3",
      itemGapClass: "gap-4",
      iconScale: iconScales.xlarge,
      titleSizeClass: "text-3xl",
      headerCompact: false,
      headerTitleSizeClass: "text-[54px]",
    }
  }

  if (count <= 5) {
    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: "py-2",
      itemPaddingClass: "py-1.5",
      itemGapClass: "gap-4",
      iconScale: iconScales.large,
      titleSizeClass: "text-2xl",
      headerCompact: false,
      headerTitleSizeClass: "text-[54px]",
    }
  }

  if (count <= 8) {
    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: "py-0",
      itemPaddingClass: "py-1",
      itemGapClass: "gap-3.5",
      iconScale: iconScales.medium,
      titleSizeClass: "text-[22px]",
      headerCompact: false,
      headerTitleSizeClass: "text-[54px]",
    }
  }

  if (count <= 16) {
    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: "py-3",
      itemPaddingClass: "py-2.5",
      itemGapClass: "gap-3.5",
      iconScale: iconScales.mediumLarge,
      titleSizeClass: "text-xl",
      headerCompact: false,
      headerTitleSizeClass: "text-5xl",
    }
  }

  if (count <= 30) {
    return {
      density,
      mode,
      gridColsClass: gridColsClasses[columns],
      groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
      groupPaddingClass: "py-2.5",
      itemPaddingClass: "py-2",
      itemGapClass: "gap-3",
      iconScale: iconScales.medium,
      titleSizeClass: "text-lg",
      headerCompact: true,
      headerTitleSizeClass: "text-[42px]",
    }
  }

  return {
    density,
    mode,
    gridColsClass: gridColsClasses[columns],
    groupGridClass: "grid-cols-[216px_minmax(0,1fr)]",
    groupPaddingClass: "py-2",
    itemPaddingClass: "py-1.5",
    itemGapClass: "gap-2.5",
    iconScale: iconScales.compact,
    titleSizeClass: "text-base",
    headerCompact: true,
    headerTitleSizeClass: "text-[40px]",
  }
}
