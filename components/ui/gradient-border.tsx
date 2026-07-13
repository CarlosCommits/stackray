import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

type GradientBorderStyle = CSSProperties & {
  "--gradient-primary": string
  "--gradient-secondary": string
  "--gradient-accent": string
  "--bg-color": string
  "--border-width": string
  "--border-radius": string
}

interface GradientBorderProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode
  className?: string
  gradientColors?: {
    primary: string
    secondary: string
    accent: string
  }
  backgroundColor?: string
  borderWidth?: number
  borderRadius?: number
  style?: CSSProperties
}

const defaultGradientColors = {
  primary: "#584827",
  secondary: "#c7a03c",
  accent: "#f9de90",
}

export function GradientBorder({
  children,
  className,
  gradientColors = defaultGradientColors,
  backgroundColor = "#2d230f",
  borderWidth = 2,
  borderRadius = 20,
  style = {},
  ...props
}: GradientBorderProps) {
  const combinedStyle: GradientBorderStyle = {
    "--gradient-primary": gradientColors.primary,
    "--gradient-secondary": gradientColors.secondary,
    "--gradient-accent": gradientColors.accent,
    "--bg-color": backgroundColor,
    "--border-width": `${borderWidth}px`,
    "--border-radius": `${borderRadius}px`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from 0deg,
        ${gradientColors.primary} 0%,
        ${gradientColors.secondary} 37%,
        ${gradientColors.accent} 30%,
        ${gradientColors.secondary} 33%,
        ${gradientColors.primary} 40%,
        ${gradientColors.primary} 50%,
        ${gradientColors.secondary} 77%,
        ${gradientColors.accent} 80%,
        ${gradientColors.secondary} 83%,
        ${gradientColors.primary} 90%
      )
    `,
    backgroundClip: "padding-box, border-box",
    backgroundOrigin: "padding-box, border-box",
    ...style,
  }

  return (
    <div
      className={cn("gradient-border-component", className)}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  )
}
