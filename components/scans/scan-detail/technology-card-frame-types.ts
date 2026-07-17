import type { TechnologyTableRow } from "./technologies"
import type { TechnologyCardDesign, TechnologyCardStyle } from "./technology-card-options"

export type TechnologyCardFrameProps = {
  readonly rows: readonly TechnologyTableRow[]
  readonly style: TechnologyCardStyle
  readonly design?: TechnologyCardDesign
  readonly target?: string
  readonly faviconUrl?: string | null
  readonly screenshotUrl?: string | null
  readonly fixedDesktop?: boolean
  readonly previewCompact?: boolean
  readonly rootRef?: React.Ref<HTMLDivElement>
  readonly exportSafe?: boolean
  readonly imageSafeMode?: boolean
  readonly badgeVisible?: boolean
  readonly whiteIconBackground?: boolean
  readonly brandVisible?: boolean
  readonly captureFrame?: boolean
  readonly rasterSafe?: boolean
}

export type TechnologyCardRendererProps = Omit<TechnologyCardFrameProps, "design">
