"use client"

import * as React from "react"
import { Calendar as CalendarIcon, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function parseLocalDate(dateString: string): Date | undefined {
  if (!dateString || dateString.trim() === "") {
    return undefined
  }
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return undefined
  }
  const [, yearStr, monthStr, dayStr] = match
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr))
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  "aria-label"?: string
  placeholder?: string
  className?: string
  wrapperClassName?: string
}

export function DatePicker({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  placeholder = "Select date",
  className,
  wrapperClassName,
}: DatePickerProps) {
  const generatedId = React.useId()
  const [open, setOpen] = React.useState(false)
  const calendarContentId = `${id ?? generatedId}-calendar-content`
  const selectedDate = parseLocalDate(value)

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatLocalDate(date))
    } else {
      onChange("")
    }
    setOpen(false)
  }

  return (
    <div className={cn("flex items-center gap-1", wrapperClassName)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-controls={calendarContentId}
            aria-expanded={open}
            aria-label={ariaLabel}
            className={cn(
              "h-8 min-w-[132px] flex-1 justify-start px-2 text-xs font-normal",
              !selectedDate && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-1.5 size-3.5 shrink-0" />
            {selectedDate ? (
              <span>{formatLocalDate(selectedDate)}</span>
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent id={calendarContentId} className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            defaultMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>
      {selectedDate && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Clear ${ariaLabel?.toLowerCase() ?? "date"}`}
          className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
