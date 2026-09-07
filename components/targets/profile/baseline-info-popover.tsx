"use client"

import { Info } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

export function BaselineInfoPopover({ baselineMode }: { baselineMode: "previous" | "pinned" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Explain comparison baseline"
        >
          <Info aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[min(18rem,calc(100vw-2rem))]"
      >
        <PopoverHeader>
          <PopoverTitle>Comparison baseline</PopoverTitle>
          <PopoverDescription>
            {baselineMode === "pinned"
              ? "Compared with the selected pinned scan."
              : "Compared with the previous completed scan."}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
