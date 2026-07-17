export type ClassicTechnologyCardDensity = "sparse" | "roomy" | "dense" | "packed"

export type ClassicTechnologyCardIconScale = {
  readonly shellClass: string
  readonly imageClass: string
  readonly imageSize: number
  readonly fallbackClass: string
}

export type ClassicTechnologyCardFrameDimensions = {
  readonly width: number
  readonly height: number
}

export type ClassicTechnologyCardLayout = {
  readonly density: ClassicTechnologyCardDensity
  readonly gridColsClass: string
  readonly gridGapClass: string
  readonly gridWrapperClass: string
  readonly gridClass: string
  readonly cardPaddingClass: string
  readonly cardGapClass: string
  readonly iconScale: ClassicTechnologyCardIconScale
  readonly titleSizeClass: string
  readonly titleWrapClass?: string
  readonly typeSizeClass: string
  readonly headerCompact: boolean
  readonly headerTitleSizeClass: string
}

type IconScaleKey = "xlarge" | "large" | "mediumLarge" | "medium" | "compact" | "tiny"

const iconScales: Record<IconScaleKey, ClassicTechnologyCardIconScale> = {
  xlarge: { shellClass: "size-14 rounded-2xl", imageClass: "size-10", imageSize: 40, fallbackClass: "size-7" },
  large: { shellClass: "size-12 rounded-xl", imageClass: "size-9", imageSize: 36, fallbackClass: "size-6" },
  mediumLarge: { shellClass: "size-11 rounded-xl", imageClass: "size-8", imageSize: 32, fallbackClass: "size-6" },
  medium: { shellClass: "size-9 rounded-lg", imageClass: "size-7", imageSize: 28, fallbackClass: "size-5" },
  compact: { shellClass: "size-8 rounded-lg", imageClass: "size-6", imageSize: 24, fallbackClass: "size-5" },
  tiny: { shellClass: "size-7 rounded-md", imageClass: "size-5", imageSize: 20, fallbackClass: "size-4" },
}

type SizePair = readonly [fixed: string, preview: string]

function resolveSize(fixedDesktop: boolean, value: SizePair | string): string {
  if (typeof value === "string") return value
  return fixedDesktop ? value[0] : value[1]
}

type CellScale =
  | IconScaleKey
  | "twoColumnRoomy"
  | "browserSingleColumn"
  | "browserTwoColumn"

type ScalePreset = {
  readonly iconScale: IconScaleKey
  readonly titleSize: SizePair | string
  readonly titleWrap?: string
  readonly typeSize: SizePair | string
  readonly cardPadding: SizePair | string
  readonly cardGap: SizePair | string
  readonly gridGap: SizePair | string
  readonly headerCompact: boolean
  readonly headerTitleSize: SizePair | string
}

const scalePresets: Record<CellScale, ScalePreset> = {
  xlarge: {
    iconScale: "xlarge",
    titleSize: ["text-3xl", "text-2xl"],
    typeSize: ["text-base", "text-sm"],
    cardPadding: ["p-8", "p-7"],
    cardGap: ["gap-6", "gap-5"],
    gridGap: ["gap-6", "gap-5"],
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  twoColumnRoomy: {
    iconScale: "xlarge",
    titleSize: ["text-[26px]", "text-2xl"],
    titleWrap: "break-words [overflow-wrap:anywhere]",
    typeSize: ["text-base", "text-sm"],
    cardPadding: ["p-7", "p-6"],
    cardGap: ["gap-4", "gap-3.5"],
    gridGap: ["gap-5", "gap-4"],
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  browserSingleColumn: {
    iconScale: "large",
    titleSize: "text-2xl",
    titleWrap: "break-words [overflow-wrap:anywhere]",
    typeSize: "text-base",
    cardPadding: "p-5",
    cardGap: "gap-4",
    gridGap: "gap-4",
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  browserTwoColumn: {
    iconScale: "mediumLarge",
    titleSize: "text-[22px]",
    titleWrap: "break-words [overflow-wrap:anywhere]",
    typeSize: "text-[15px]",
    cardPadding: "p-[18px]",
    cardGap: "gap-3.5",
    gridGap: "gap-4",
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  large: {
    iconScale: "large",
    titleSize: ["text-2xl", "text-xl"],
    typeSize: ["text-sm", "text-xs"],
    cardPadding: ["p-7", "p-6"],
    cardGap: ["gap-5", "gap-4"],
    gridGap: ["gap-5", "gap-4"],
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  mediumLarge: {
    iconScale: "mediumLarge",
    titleSize: ["text-xl", "text-lg"],
    typeSize: ["text-sm", "text-xs"],
    cardPadding: ["p-6", "p-5"],
    cardGap: ["gap-5", "gap-4"],
    gridGap: ["gap-5", "gap-4"],
    headerCompact: false,
    headerTitleSize: ["text-5xl", "text-4xl"],
  },
  medium: {
    iconScale: "medium",
    titleSize: ["text-base", "text-sm"],
    typeSize: ["text-xs", "text-[11px]"],
    cardPadding: ["p-4", "p-3.5"],
    cardGap: ["gap-3", "gap-2.5"],
    gridGap: ["gap-4", "gap-3"],
    headerCompact: true,
    headerTitleSize: ["text-3xl", "text-2xl"],
  },
  compact: {
    iconScale: "compact",
    titleSize: ["text-xs", "text-[11px]"],
    typeSize: ["text-[10px]", "text-[9px]"],
    cardPadding: ["p-3", "p-2"],
    cardGap: ["gap-2", "gap-1.5"],
    gridGap: ["gap-3", "gap-2"],
    headerCompact: true,
    headerTitleSize: ["text-2xl", "text-xl"],
  },
  tiny: {
    iconScale: "tiny",
    titleSize: "text-[11px]",
    typeSize: "text-[9px]",
    cardPadding: "p-1.5",
    cardGap: "gap-1",
    gridGap: "gap-2",
    headerCompact: true,
    headerTitleSize: ["text-2xl", "text-xl"],
  },
}

const gridColsClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
}

const portraitFixedFrameHeights = [500, 500, 700] as const
export const classicTechnologyCardFrameWidth = 720

const SCREENSHOT_FRAME_WIDTH = 1024
const SCREENSHOT_FRAME_HEIGHT = 640
const FIXED_FRAME_PADDING = 56
const SCREENSHOT_BROWSER_CHROME_HEIGHT = 39
const SCREENSHOT_EXTRA_GAP_DELTA = 16

export function getClassicScreenshotBrowserHeightPx(frameWidth: number): number {
  const innerWidth = frameWidth - FIXED_FRAME_PADDING
  return Math.round((innerWidth * SCREENSHOT_FRAME_HEIGHT) / SCREENSHOT_FRAME_WIDTH) + SCREENSHOT_BROWSER_CHROME_HEIGHT
}

function getScreenshotExtraFrameHeight(frameWidth: number): number {
  return getClassicScreenshotBrowserHeightPx(frameWidth) + SCREENSHOT_EXTRA_GAP_DELTA
}

const PORTRAIT_FIXED_OVERHEAD = 175
const TECHNOLOGY_CARD_BRAND_FOOTER_EXTRA_HEIGHT = 48
const PORTRAIT_ROW_HEIGHT = (500 - PORTRAIT_FIXED_OVERHEAD) / 2

function getPortraitFixedFrameHeight(count: number, hasScreenshot = false): number {
  if (count === 6) return 700
  if (count === 1) return Math.round(PORTRAIT_FIXED_OVERHEAD + PORTRAIT_ROW_HEIGHT)
  if (hasScreenshot && count >= 3 && count <= 5) {
    return Math.round(PORTRAIT_FIXED_OVERHEAD + count * PORTRAIT_ROW_HEIGHT)
  }
  if (count >= 4) return 900
  const clamped = Math.max(1, Math.min(3, count)) - 1
  return portraitFixedFrameHeights[clamped]
}

export function getClassicTechnologyCardFixedFrameDimensions(
  count: number,
  hasScreenshot = false,
  hasBrandFooter = false,
): ClassicTechnologyCardFrameDimensions {
  const baseHeight = getPortraitFixedFrameHeight(count, hasScreenshot)
  const screenshotHeight = hasScreenshot ? getScreenshotExtraFrameHeight(classicTechnologyCardFrameWidth) : 0
  const brandFooterHeight = hasBrandFooter ? TECHNOLOGY_CARD_BRAND_FOOTER_EXTRA_HEIGHT : 0
  return {
    width: classicTechnologyCardFrameWidth,
    height: baseHeight + screenshotHeight + brandFooterHeight,
  }
}

function getTechnologyCardColumns(count: number): number {
  if (count <= 5) return 1
  if (count <= 20) return 2
  if (count <= 30) return 3
  return 4
}

function getTechnologyCardDensity(count: number): ClassicTechnologyCardDensity {
  if (count <= 4) return "sparse"
  if (count <= 8) return "roomy"
  if (count <= 20) return "dense"
  return "packed"
}

function getPortraitCellScale(cols: number, rows: number): CellScale {
  const table: Record<string, CellScale> = {
    "1x1": "xlarge", "1x2": "xlarge", "1x3": "xlarge", "1x4": "xlarge", "1x5": "xlarge",
    "1x6": "mediumLarge", "1x7": "medium", "1x8": "medium", "1x9": "medium",
    "2x3": "twoColumnRoomy", "2x4": "twoColumnRoomy", "2x5": "mediumLarge", "2x6": "medium",
    "2x7": "compact", "2x8": "compact", "2x9": "compact", "2x10": "compact",
    "3x7": "compact", "3x8": "compact", "3x9": "compact", "3x10": "tiny",
    "4x8": "compact", "4x9": "tiny", "4x10": "tiny",
  }
  const scale = table[`${cols}x${rows}`]
  if (scale) return scale
  if (cols >= 4) return "tiny"
  if (cols >= 2) return "compact"
  return "compact"
}

export function getClassicTechnologyCardLayout(
  count: number,
  fixedDesktop: boolean,
  hasScreenshot = false,
): ClassicTechnologyCardLayout {
  const density = getTechnologyCardDensity(count)
  const columns = getTechnologyCardColumns(count)
  const rows = Math.max(1, Math.ceil(count / columns))
  const cellScale = hasScreenshot && count > 0 && count <= 5
    ? "browserSingleColumn"
    : hasScreenshot && count <= 8
      ? "browserTwoColumn"
      : getPortraitCellScale(columns, rows)
  const preset = scalePresets[cellScale]
  const stretch = count >= 1

  return {
    density,
    gridColsClass: gridColsClasses[columns] ?? "grid-cols-4",
    gridGapClass: resolveSize(fixedDesktop, preset.gridGap),
    gridWrapperClass: stretch
      ? "flex min-h-0 flex-1 flex-col"
      : "flex min-h-0 flex-1 flex-col items-center justify-center",
    gridClass: stretch ? "grid h-full w-full [grid-auto-rows:1fr]" : "grid w-full",
    cardPaddingClass: resolveSize(fixedDesktop, preset.cardPadding),
    cardGapClass: resolveSize(fixedDesktop, preset.cardGap),
    iconScale: iconScales[preset.iconScale],
    titleSizeClass: resolveSize(fixedDesktop, preset.titleSize),
    titleWrapClass: preset.titleWrap,
    typeSizeClass: resolveSize(fixedDesktop, preset.typeSize),
    headerCompact: preset.headerCompact,
    headerTitleSizeClass: resolveSize(fixedDesktop, preset.headerTitleSize),
  }
}
