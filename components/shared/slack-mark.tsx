import type { SVGProps } from "react";

type SlackMarkProps = SVGProps<SVGSVGElement> & {
  variant?: "monochrome" | "brand";
};

export function SlackMark({ variant = "monochrome", ...props }: SlackMarkProps) {
  if (variant === "brand") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
        <path fill="#36C5F0" d="M5.042 14.165a2.528 2.528 0 1 1-5.056 0 2.528 2.528 0 0 1 5.056 0Zm1.265 0a2.528 2.528 0 0 1 5.056 0v6.32a2.528 2.528 0 1 1-5.056 0v-6.32Z" />
        <path fill="#2EB67D" d="M9.488 5.042a2.528 2.528 0 1 1 0-5.056 2.528 2.528 0 0 1 0 5.056Zm0 1.265a2.528 2.528 0 0 1 0 5.056h-6.32a2.528 2.528 0 1 1 0-5.056h6.32Z" />
        <path fill="#ECB22E" d="M18.61 9.488a2.528 2.528 0 1 1 5.057 0 2.528 2.528 0 0 1-5.056 0Zm-1.264 0a2.528 2.528 0 0 1-5.057 0v-6.32a2.528 2.528 0 1 1 5.057 0v6.32Z" />
        <path fill="#E01E5A" d="M14.165 18.61a2.528 2.528 0 1 1 0 5.057 2.528 2.528 0 0 1 0-5.056Zm0-1.264a2.528 2.528 0 0 1 0-5.057h6.32a2.528 2.528 0 1 1 0 5.057h-6.32Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M6 15a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5Zm2-8a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h5Zm8 2a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v5Zm-2 8a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5Z" />
    </svg>
  );
}
