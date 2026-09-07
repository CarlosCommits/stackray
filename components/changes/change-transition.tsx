import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type ChangeTransitionProps = {
  before: ReactNode;
  after: ReactNode;
  ariaLabel: string;
  className?: string;
};

export function ChangeTransition({
  before,
  after,
  ariaLabel,
  className,
}: ChangeTransitionProps) {
  return (
    <div
      data-slot="change-transition"
      className={cn(
        "grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-8",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <div className="min-w-0">{before}</div>
      <div
        data-slot="change-transition-connector"
        className="justify-self-center self-center text-muted-foreground sm:justify-self-auto"
        aria-hidden="true"
      >
        <ArrowRight className="size-7 rotate-90 sm:size-8 sm:rotate-0" />
      </div>
      <div className="min-w-0">{after}</div>
    </div>
  );
}
