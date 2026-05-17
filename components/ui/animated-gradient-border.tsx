import type { CSSProperties, HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

type AnimationMode = "auto-rotate" | "rotate-on-hover" | "stop-rotate-on-hover"

type GradientBorderStyle = CSSProperties & {
  "--gradient-primary": string
  "--gradient-secondary": string
  "--gradient-accent": string
  "--bg-color": string
  "--border-width": string
  "--border-radius": string
  "--animation-duration": string
}

interface BorderRotateProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode
  className?: string
  animationMode?: AnimationMode
  animationSpeed?: number
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

const animationClassNames: Record<AnimationMode, string> = {
  "auto-rotate": "gradient-border-auto",
  "rotate-on-hover": "gradient-border-hover",
  "stop-rotate-on-hover": "gradient-border-stop-hover",
}

function BorderRotate({
  children,
  className,
  animationMode = "auto-rotate",
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = "#2d230f",
  borderWidth = 2,
  borderRadius = 20,
  style = {},
  ...props
}: BorderRotateProps) {
  const combinedStyle: GradientBorderStyle = {
    "--gradient-primary": gradientColors.primary,
    "--gradient-secondary": gradientColors.secondary,
    "--gradient-accent": gradientColors.accent,
    "--bg-color": backgroundColor,
    "--border-width": `${borderWidth}px`,
    "--border-radius": `${borderRadius}px`,
    "--animation-duration": `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from var(--gradient-angle, 0deg),
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
      className={cn("gradient-border-component", animationClassNames[animationMode], className)}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  )
}

export { BorderRotate }
