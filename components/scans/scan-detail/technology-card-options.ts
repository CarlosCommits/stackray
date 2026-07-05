export type TechnologyCardStyle = "stackray" | "sunset" | "aurora" | "mono"

export type TechnologyCardThemeProfile = {
  readonly frameClass: string
  readonly headerDividerClass: string
  readonly badgeClass: string
  readonly itemCardClass: string
  readonly itemDottedClass: string
  readonly itemSeparatorClass: string
  readonly itemTypeClass: string
  readonly iconTileClass: string
  readonly targetTileClass: string
  readonly browserShellClass: string
  readonly browserChromeClass: string
  readonly browserDotClass: string
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
      "border-amber-200/34 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_18%,rgba(0,0,0,0.26)_100%),linear-gradient(105deg,rgba(245,158,11,0.18)_0%,rgba(245,158,11,0.05)_18%,transparent_42%),linear-gradient(255deg,rgba(245,158,11,0.16)_0%,rgba(245,158,11,0.045)_22%,transparent_52%),linear-gradient(135deg,#08090b,#11110e_48%,#080a0c)] shadow-[0_26px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)]",
    headerDividerClass:
      "bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.32),rgba(255,255,255,0.24),rgba(245,158,11,0.32),transparent)]",
    badgeClass:
      "border-amber-200/30 bg-black/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(245,158,11,0.14)]",
    itemCardClass:
      "border-amber-100/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.022)_42%,rgba(0,0,0,0.12)),linear-gradient(105deg,rgba(245,158,11,0.06),transparent_52%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_42px_rgba(0,0,0,0.28)]",
    itemDottedClass:
      "[background-image:radial-gradient(circle,rgba(245,158,11,0.62)_1px,transparent_1.5px)]",
    itemSeparatorClass: "bg-amber-300/58 shadow-[0_0_18px_rgba(245,158,11,0.36)]",
    itemTypeClass: "text-amber-200/78",
    iconTileClass:
      "border-amber-200/28 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_26px_rgba(245,158,11,0.12)] ring-black/30",
    targetTileClass:
      "border-amber-200/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_0_1px_rgba(245,158,11,0.18),0_0_34px_rgba(245,158,11,0.38),0_0_70px_rgba(245,158,11,0.12)] ring-black/30",
    browserShellClass:
      "border-amber-200/30 bg-black/24 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_18px_52px_rgba(245,158,11,0.16),0_22px_54px_rgba(0,0,0,0.45)]",
    browserChromeClass:
      "border-amber-200/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.16),rgba(0,0,0,0.22))]",
    browserDotClass: "bg-amber-300/52 shadow-[0_0_14px_rgba(245,158,11,0.28)]",
    fallbackIconClass: "text-amber-100",
  },
  sunset: {
    frameClass:
      "border-orange-100/36 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%,rgba(0,0,0,0.24)_100%),linear-gradient(110deg,rgba(251,146,60,0.24)_0%,rgba(244,114,182,0.12)_24%,transparent_52%),linear-gradient(250deg,rgba(168,85,247,0.26)_0%,rgba(236,72,153,0.12)_30%,transparent_64%),linear-gradient(135deg,#130909,#281019_48%,#170923)] shadow-[0_26px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)]",
    headerDividerClass:
      "bg-[linear-gradient(90deg,transparent,rgba(251,146,60,0.34),rgba(244,114,182,0.28),rgba(168,85,247,0.28),transparent)]",
    badgeClass:
      "border-orange-100/32 bg-black/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(244,114,182,0.18)]",
    itemCardClass:
      "border-orange-100/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.024)_42%,rgba(0,0,0,0.12)),linear-gradient(105deg,rgba(251,146,60,0.07),rgba(236,72,153,0.035)_46%,transparent_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_42px_rgba(0,0,0,0.28)]",
    itemDottedClass:
      "[background-image:radial-gradient(circle,rgba(251,146,60,0.64)_1px,transparent_1.5px)]",
    itemSeparatorClass: "bg-orange-300/60 shadow-[0_0_18px_rgba(244,114,182,0.36)]",
    itemTypeClass: "text-orange-100/82",
    iconTileClass:
      "border-orange-200/34 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.035))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_26px_rgba(244,114,182,0.16)] ring-black/30",
    targetTileClass:
      "border-orange-100/58 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_0_1px_rgba(251,146,60,0.18),0_0_34px_rgba(244,114,182,0.38),0_0_70px_rgba(168,85,247,0.14)] ring-black/30",
    browserShellClass:
      "border-orange-100/30 bg-black/24 shadow-[0_0_0_1px_rgba(251,146,60,0.14),0_18px_52px_rgba(244,114,182,0.18),0_22px_54px_rgba(0,0,0,0.45)]",
    browserChromeClass:
      "border-orange-100/20 bg-[linear-gradient(180deg,rgba(251,146,60,0.15),rgba(168,85,247,0.1)_48%,rgba(0,0,0,0.24))]",
    browserDotClass: "bg-orange-300/56 shadow-[0_0_14px_rgba(244,114,182,0.3)]",
    fallbackIconClass: "text-orange-100",
  },
  aurora: {
    frameClass:
      "border-cyan-100/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent_18%,rgba(0,0,0,0.25)_100%),linear-gradient(112deg,rgba(45,212,191,0.2)_0%,rgba(56,189,248,0.08)_26%,transparent_56%),linear-gradient(248deg,rgba(167,139,250,0.24)_0%,rgba(56,189,248,0.08)_32%,transparent_66%),linear-gradient(135deg,#061312,#0b1626_52%,#151231)] shadow-[0_26px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.12)]",
    headerDividerClass:
      "bg-[linear-gradient(90deg,transparent,rgba(45,212,191,0.34),rgba(125,211,252,0.3),rgba(167,139,250,0.3),transparent)]",
    badgeClass:
      "border-cyan-100/30 bg-black/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(45,212,191,0.18)]",
    itemCardClass:
      "border-cyan-100/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.075),rgba(255,255,255,0.024)_42%,rgba(0,0,0,0.12)),linear-gradient(105deg,rgba(45,212,191,0.06),rgba(167,139,250,0.032)_50%,transparent_72%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_42px_rgba(0,0,0,0.28)]",
    itemDottedClass:
      "[background-image:radial-gradient(circle,rgba(45,212,191,0.62)_1px,transparent_1.5px)]",
    itemSeparatorClass: "bg-cyan-300/58 shadow-[0_0_18px_rgba(45,212,191,0.38)]",
    itemTypeClass: "text-cyan-100/82",
    iconTileClass:
      "border-cyan-100/32 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.035))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_26px_rgba(45,212,191,0.16)] ring-black/30",
    targetTileClass:
      "border-cyan-100/52 bg-[linear-gradient(135deg,rgba(255,255,255,0.13),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_0_1px_rgba(45,212,191,0.18),0_0_34px_rgba(45,212,191,0.36),0_0_70px_rgba(167,139,250,0.16)] ring-black/30",
    browserShellClass:
      "border-cyan-100/26 bg-black/24 shadow-[0_0_0_1px_rgba(45,212,191,0.12),0_18px_52px_rgba(45,212,191,0.16),0_22px_54px_rgba(0,0,0,0.45)]",
    browserChromeClass:
      "border-cyan-100/18 bg-[linear-gradient(180deg,rgba(45,212,191,0.13),rgba(167,139,250,0.1)_48%,rgba(0,0,0,0.24))]",
    browserDotClass: "bg-cyan-300/54 shadow-[0_0_14px_rgba(45,212,191,0.3)]",
    fallbackIconClass: "text-cyan-100",
  },
  mono: {
    frameClass:
      "border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_20%,rgba(0,0,0,0.28)_100%),linear-gradient(112deg,rgba(255,255,255,0.08)_0%,rgba(148,163,184,0.035)_24%,transparent_58%),linear-gradient(248deg,rgba(148,163,184,0.09)_0%,rgba(255,255,255,0.025)_30%,transparent_64%),linear-gradient(135deg,#0d1117,#10151c_58%,#07090c)] shadow-[0_26px_90px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.12)]",
    headerDividerClass:
      "bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),rgba(148,163,184,0.32),rgba(255,255,255,0.22),transparent)]",
    badgeClass:
      "border-white/22 bg-black/24 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(255,255,255,0.08)]",
    itemCardClass:
      "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.022)_42%,rgba(0,0,0,0.13)),linear-gradient(105deg,rgba(255,255,255,0.035),rgba(148,163,184,0.02)_48%,transparent_72%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_42px_rgba(0,0,0,0.3)]",
    itemDottedClass:
      "[background-image:radial-gradient(circle,rgba(226,232,240,0.42)_1px,transparent_1.5px)]",
    itemSeparatorClass: "bg-white/42 shadow-[0_0_18px_rgba(255,255,255,0.16)]",
    itemTypeClass: "text-white/64",
    iconTileClass:
      "border-white/18 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.035))] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_26px_rgba(255,255,255,0.07)] ring-black/30",
    targetTileClass:
      "border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_0_1px_rgba(255,255,255,0.08),0_0_34px_rgba(255,255,255,0.16),0_0_70px_rgba(148,163,184,0.1)] ring-black/30",
    browserShellClass:
      "border-white/18 bg-black/24 shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_18px_52px_rgba(148,163,184,0.08),0_22px_54px_rgba(0,0,0,0.48)]",
    browserChromeClass:
      "border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.24))]",
    browserDotClass: "bg-white/42 shadow-[0_0_14px_rgba(255,255,255,0.12)]",
    fallbackIconClass: "text-white/86",
  },
}
