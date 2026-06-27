export type TechnologyCardDensity = "sparse" | "roomy" | "dense" | "packed"

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
  readonly gridColsClass: string
  readonly gridRowsClass: string
  readonly gridGapClass: string
  readonly gridWrapperClass: string
  readonly gridClass: string
  readonly cardPaddingClass: string
  readonly cardGapClass: string
  readonly iconScale: TechnologyCardIconScale
  readonly titleSizeClass: string
  readonly titleWrapClass?: string
  readonly typeSizeClass: string
  readonly headerCompact: boolean
  readonly headerTitleSizeClass: string
  readonly cardContentAlignClass?: string
}

type IconScaleKey = "hero" | "xlarge" | "large" | "mediumLarge" | "medium" | "compact" | "tiny"

const iconScales: Record<IconScaleKey, TechnologyCardIconScale> = {
  hero: { shellClass: "size-16 rounded-2xl", imageClass: "size-12", imageSize: 48, fallbackClass: "size-8" },
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

type CellScale = IconScaleKey | "twoColumnRoomy" | "browserRoomy"

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
  hero: { iconScale: "hero", titleSize: ["text-4xl", "text-3xl"], typeSize: ["text-lg", "text-base"], cardPadding: ["p-10", "p-8"], cardGap: ["gap-6", "gap-5"], gridGap: ["gap-6", "gap-4"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  xlarge: { iconScale: "xlarge", titleSize: ["text-3xl", "text-2xl"], typeSize: ["text-base", "text-sm"], cardPadding: ["p-8", "p-7"], cardGap: ["gap-6", "gap-5"], gridGap: ["gap-6", "gap-5"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  twoColumnRoomy: { iconScale: "xlarge", titleSize: ["text-[26px]", "text-2xl"], titleWrap: "break-words [overflow-wrap:anywhere]", typeSize: ["text-base", "text-sm"], cardPadding: ["p-7", "p-6"], cardGap: ["gap-4", "gap-3.5"], gridGap: ["gap-5", "gap-4"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  browserRoomy: { iconScale: "mediumLarge", titleSize: ["text-xl", "text-lg"], titleWrap: "break-words [overflow-wrap:anywhere]", typeSize: ["text-sm", "text-xs"], cardPadding: ["p-4", "p-3.5"], cardGap: ["gap-4", "gap-3.5"], gridGap: ["gap-4", "gap-3"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  large: { iconScale: "large", titleSize: ["text-2xl", "text-xl"], typeSize: ["text-sm", "text-xs"], cardPadding: ["p-7", "p-6"], cardGap: ["gap-5", "gap-4"], gridGap: ["gap-5", "gap-4"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  mediumLarge: { iconScale: "mediumLarge", titleSize: ["text-xl", "text-lg"], typeSize: ["text-sm", "text-xs"], cardPadding: ["p-6", "p-5"], cardGap: ["gap-5", "gap-4"], gridGap: ["gap-5", "gap-4"], headerCompact: false, headerTitleSize: ["text-5xl", "text-4xl"] },
  medium: { iconScale: "medium", titleSize: ["text-base", "text-sm"], typeSize: ["text-xs", "text-[11px]"], cardPadding: ["p-4", "p-3.5"], cardGap: ["gap-3", "gap-2.5"], gridGap: ["gap-4", "gap-3"], headerCompact: true, headerTitleSize: ["text-3xl", "text-2xl"] },
  compact: { iconScale: "compact", titleSize: ["text-xs", "text-[11px]"], typeSize: ["text-[10px]", "text-[9px]"], cardPadding: ["p-3", "p-2"], cardGap: ["gap-2", "gap-1.5"], gridGap: ["gap-3", "gap-2"], headerCompact: true, headerTitleSize: ["text-2xl", "text-xl"] },
  tiny: { iconScale: "tiny", titleSize: "text-[11px]", typeSize: "text-[9px]", cardPadding: "p-1.5", cardGap: "gap-1", gridGap: "gap-2", headerCompact: true, headerTitleSize: ["text-2xl", "text-xl"] },
}

const gridColsClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
}

const portraitFixedFrameHeights = [500, 500, 700] as const
export const portraitFixedFrameWidth = 720

// Scan screenshots are captured by httpx at a fixed 1024x640 viewport (16:10).
export const SCREENSHOT_FRAME_WIDTH = 1024
export const SCREENSHOT_FRAME_HEIGHT = 640
// Fixed desktop frames use p-7 (28px) padding on every side.
const FIXED_FRAME_PADDING = 56
// Browser chrome bar (h-9 = 36px) plus its bottom divider (1px) and the shell border (2px).
const SCREENSHOT_BROWSER_CHROME_HEIGHT = 39
// Adding the screenshot slot swaps the single header→grid gap-6 (24px) for two gap-5 (20px) gaps.
const SCREENSHOT_EXTRA_GAP_DELTA = 16

export function getScreenshotBrowserHeightPx(frameWidth: number): number {
  const innerWidth = frameWidth - FIXED_FRAME_PADDING
  return Math.round((innerWidth * SCREENSHOT_FRAME_HEIGHT) / SCREENSHOT_FRAME_WIDTH) + SCREENSHOT_BROWSER_CHROME_HEIGHT
}

export function getScreenshotExtraFrameHeight(frameWidth: number): number {
  return getScreenshotBrowserHeightPx(frameWidth) + SCREENSHOT_EXTRA_GAP_DELTA
}

// Fixed overhead in the portrait frame without the screenshot slot:
// frame p-7 padding (56px) + non-compact header (~95px) + single gap-6 (24px).
// Used to grow the canvas proportionally so technology item cards keep the
// same row height as the 1–2 technology layout when the screenshot is shown.
const PORTRAIT_FIXED_OVERHEAD = 175
// Row height at the 500px / 2-technology baseline (the size the user likes).
const PORTRAIT_ROW_HEIGHT = (500 - PORTRAIT_FIXED_OVERHEAD) / 2 // 162.5

function getPortraitFixedFrameHeight(count: number, hasScreenshot = false): number {
  if (count === 6) return 700
  // A single technology uses the same row height as the 2-technology layout
  // (~162.5px) instead of the hero-sized 500px canvas, so its item card matches
  // the size users see at count=2. The canvas shrinks to fit one row.
  if (count === 1) {
    return Math.round(PORTRAIT_FIXED_OVERHEAD + PORTRAIT_ROW_HEIGHT)
  }
  // With the screenshot enabled, grow the canvas proportionally for 3–5
  // technologies so each row keeps the same height as the 2-technology layout
  // instead of jumping to the taller 700px/900px base canvases.
  if (hasScreenshot && count >= 3 && count <= 5) {
    return Math.round(PORTRAIT_FIXED_OVERHEAD + count * PORTRAIT_ROW_HEIGHT)
  }
  if (count >= 4) return 900
  const clamped = Math.max(1, Math.min(3, count)) - 1
  return portraitFixedFrameHeights[clamped]
}

export function getTechnologyCardFixedFrameDimensions(
  count: number,
  hasScreenshot = false,
): TechnologyCardFrameDimensions {
  const baseHeight = getPortraitFixedFrameHeight(count, hasScreenshot)
  const height = hasScreenshot ? baseHeight + getScreenshotExtraFrameHeight(portraitFixedFrameWidth) : baseHeight
  return { width: portraitFixedFrameWidth, height }
}

function getTechnologyCardColumns(count: number): number {
  if (count <= 5) return 1
  if (count <= 20) return 2
  if (count <= 30) return 3
  return 4
}

function getTechnologyCardRows(count: number, cols: number): number {
  return Math.max(1, Math.ceil(count / cols))
}

function getTechnologyCardDensity(count: number): TechnologyCardDensity {
  if (count <= 4) return "sparse"
  if (count <= 8) return "roomy"
  if (count <= 20) return "dense"
  return "packed"
}

function getPortraitCellScale(cols: number, rows: number): CellScale {
  const key = `${cols}x${rows}`
  const table: Record<string, CellScale> = {
    "1x1": "xlarge",
    "1x2": "xlarge",
    "1x3": "xlarge",
    "1x4": "xlarge",
    "1x5": "xlarge",
    "1x6": "mediumLarge",
    "1x7": "medium",
    "1x8": "medium",
    "1x9": "medium",
    "2x3": "twoColumnRoomy",
    "2x4": "twoColumnRoomy",
    "2x5": "mediumLarge",
    "2x6": "medium",
    "2x7": "compact",
    "2x8": "compact",
    "2x9": "compact",
    "2x10": "compact",
    "3x7": "compact",
    "3x8": "compact",
    "3x9": "compact",
    "3x10": "tiny",
    "4x8": "compact",
    "4x9": "tiny",
    "4x10": "tiny",
  }
  if (key in table) return table[key]
  if (cols >= 4) return "tiny"
  if (cols >= 3) return "compact"
  if (cols >= 2) return "compact"
  return "compact"
}

function makeLayout(
  fixedDesktop: boolean,
  density: TechnologyCardDensity,
  preset: ScalePreset,
  opts: {
    readonly cols: string
    readonly stretch: boolean
    readonly contentAlign?: string
  },
): TechnologyCardLayout {
  const gridWrapperClass = opts.stretch
    ? "flex min-h-0 flex-1 flex-col"
    : "flex min-h-0 flex-1 flex-col items-center justify-center"

  const gridClass = opts.stretch
    ? "grid h-full w-full [grid-auto-rows:1fr]"
    : "grid w-full"

  return {
    density,
    gridColsClass: opts.cols,
    gridRowsClass: "",
    gridGapClass: resolveSize(fixedDesktop, preset.gridGap),
    gridWrapperClass,
    gridClass,
    cardPaddingClass: resolveSize(fixedDesktop, preset.cardPadding),
    cardGapClass: resolveSize(fixedDesktop, preset.cardGap),
    iconScale: iconScales[preset.iconScale],
    titleSizeClass: resolveSize(fixedDesktop, preset.titleSize),
    titleWrapClass: preset.titleWrap,
    typeSizeClass: resolveSize(fixedDesktop, preset.typeSize),
    headerCompact: preset.headerCompact,
    headerTitleSizeClass: resolveSize(fixedDesktop, preset.headerTitleSize),
    cardContentAlignClass: opts.contentAlign,
  }
}

export function getTechnologyCardLayout(
  count: number,
  fixedDesktop: boolean,
  hasScreenshot = false,
): TechnologyCardLayout {
  const density = getTechnologyCardDensity(count)
  const cols = getTechnologyCardColumns(count)
  const rows = getTechnologyCardRows(count, cols)
  const cellScale = hasScreenshot && count > 0 && count <= 8 ? "browserRoomy" : getPortraitCellScale(cols, rows)
  const preset = scalePresets[cellScale]

  const colsClass = gridColsClasses[cols] ?? "grid-cols-6"
  const stretch = count >= 1

  return makeLayout(fixedDesktop, density, preset, {
    cols: colsClass,
    stretch,
  })
}
