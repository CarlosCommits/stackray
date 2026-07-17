export type TechnologyCardStyle = "stackray" | "sunset" | "aurora" | "mono"

export type TechnologyCardDesign = "dossier" | "classic"

export const technologyCardDesignOptions: ReadonlyArray<{
  readonly value: TechnologyCardDesign
  readonly label: string
  readonly description: string
}> = [
  { value: "dossier", label: "Dossier", description: "Grouped report" },
  { value: "classic", label: "Classic", description: "Stacked cards" },
]

export type TechnologyCardThemeProfile = {
  readonly frameClass: string
  readonly accentTextClass: string
  readonly headerRuleClass: string
  readonly countClass: string
  readonly screenshotClass: string
  readonly groupRuleClass: string
  readonly groupLabelClass: string
  readonly iconTileClass: string
  readonly fallbackIconClass: string
}

export const technologyCardStyleOptions: ReadonlyArray<{
  readonly value: TechnologyCardStyle
  readonly label: string
}> = [
  { value: "stackray", label: "Stackray" },
  { value: "sunset", label: "Sunset" },
  { value: "aurora", label: "Aurora" },
  { value: "mono", label: "Mono" },
]

export const technologyCardThemeProfiles: Record<TechnologyCardStyle, TechnologyCardThemeProfile> = {
  stackray: {
    frameClass:
      "border-amber-200/28 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,0.14),transparent_28%),linear-gradient(145deg,#11110d_0%,#090a0c_52%,#0b0d0f_100%)]",
    accentTextClass: "text-amber-300",
    headerRuleClass: "bg-amber-300/55",
    countClass: "text-amber-200",
    screenshotClass: "border-amber-100/20 bg-black/35",
    groupRuleClass: "border-amber-100/16",
    groupLabelClass: "text-amber-200/78",
    iconTileClass: "bg-amber-50/[0.07]",
    fallbackIconClass: "text-amber-100",
  },
  sunset: {
    frameClass:
      "border-orange-100/28 bg-[radial-gradient(circle_at_9%_0%,rgba(251,146,60,0.16),transparent_30%),radial-gradient(circle_at_100%_16%,rgba(192,132,252,0.11),transparent_30%),linear-gradient(145deg,#160d0b_0%,#100b10_54%,#0d0b12_100%)]",
    accentTextClass: "text-orange-300",
    headerRuleClass: "bg-orange-300/58",
    countClass: "text-orange-100",
    screenshotClass: "border-orange-100/20 bg-black/35",
    groupRuleClass: "border-orange-100/16",
    groupLabelClass: "text-orange-100/78",
    iconTileClass: "bg-orange-50/[0.07]",
    fallbackIconClass: "text-orange-100",
  },
  aurora: {
    frameClass:
      "border-cyan-100/26 bg-[radial-gradient(circle_at_8%_0%,rgba(45,212,191,0.15),transparent_30%),radial-gradient(circle_at_100%_14%,rgba(167,139,250,0.12),transparent_32%),linear-gradient(145deg,#071312_0%,#081017_52%,#0e0c18_100%)]",
    accentTextClass: "text-teal-300",
    headerRuleClass: "bg-teal-300/58",
    countClass: "text-cyan-100",
    screenshotClass: "border-cyan-100/18 bg-black/35",
    groupRuleClass: "border-cyan-100/15",
    groupLabelClass: "text-cyan-100/76",
    iconTileClass: "bg-cyan-50/[0.07]",
    fallbackIconClass: "text-cyan-100",
  },
  mono: {
    frameClass:
      "border-white/20 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(145deg,#12161b_0%,#0b0e12_55%,#080a0d_100%)]",
    accentTextClass: "text-white/72",
    headerRuleClass: "bg-white/36",
    countClass: "text-white/90",
    screenshotClass: "border-white/16 bg-black/35",
    groupRuleClass: "border-white/12",
    groupLabelClass: "text-white/58",
    iconTileClass: "bg-white/[0.065]",
    fallbackIconClass: "text-white/84",
  },
}
