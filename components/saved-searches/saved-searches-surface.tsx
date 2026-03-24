"use client"

import { Bookmark, Pin, PinOff, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import type { SavedSearchRow } from "./types"
import {
  SAVED_SEARCHES_RENAME_BUTTON_LABEL,
  SAVED_SEARCHES_DELETE_BUTTON_LABEL,
  SAVED_SEARCHES_PIN_BUTTON_LABEL,
  SAVED_SEARCHES_UNPIN_BUTTON_LABEL,
  SAVED_SEARCHES_PINNED_STATUS_LABEL,
  SAVED_SEARCHES_UNPINNED_STATUS_LABEL,
} from "./types"

interface SavedSearchesSurfaceProps {
  rows: SavedSearchRow[]
  onEdit: (row: SavedSearchRow) => void
  onDelete: (row: SavedSearchRow) => void
  onTogglePinned: (savedSearchId: string) => void
}

export function SavedSearchesSurface({ rows, onEdit, onDelete, onTogglePinned }: SavedSearchesSurfaceProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Query Description</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const pinButtonLabel = row.pinned
                ? `${SAVED_SEARCHES_UNPIN_BUTTON_LABEL} for ${row.name}`
                : `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for ${row.name}`

              return (
                <TableRow
                  key={row.id}
                  data-pinned={row.pinned}
                  className="data-[pinned=true]:bg-primary/5"
                >
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          {row.pinned ? (
                            <Pin className="text-primary" />
                          ) : (
                            <Bookmark className="text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {row.pinned ? SAVED_SEARCHES_PINNED_STATUS_LABEL : SAVED_SEARCHES_UNPINNED_STATUS_LABEL}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {row.pinned ? SAVED_SEARCHES_PINNED_STATUS_LABEL : SAVED_SEARCHES_UNPINNED_STATUS_LABEL}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">
                    {row.queryDescription}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={pinButtonLabel}
                            onClick={() => onTogglePinned(row.id)}
                          >
                            {row.pinned ? <PinOff /> : <Pin />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {row.pinned ? SAVED_SEARCHES_UNPIN_BUTTON_LABEL : SAVED_SEARCHES_PIN_BUTTON_LABEL}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`${SAVED_SEARCHES_RENAME_BUTTON_LABEL} for ${row.name}`}
                            onClick={() => onEdit(row)}
                          >
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{SAVED_SEARCHES_RENAME_BUTTON_LABEL}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive hover:text-destructive"
                            aria-label={`${SAVED_SEARCHES_DELETE_BUTTON_LABEL} ${row.name}`}
                            onClick={() => onDelete(row)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{SAVED_SEARCHES_DELETE_BUTTON_LABEL}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {rows.map((row) => {
          const pinButtonLabel = row.pinned
            ? `${SAVED_SEARCHES_UNPIN_BUTTON_LABEL} for ${row.name}`
            : `${SAVED_SEARCHES_PIN_BUTTON_LABEL} for ${row.name}`

          return (
            <Card
              key={row.id}
              data-pinned={row.pinned}
              className="data-[pinned=true]:border-primary/50"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {row.pinned ? (
                      <Pin className="text-primary" />
                    ) : (
                      <Bookmark className="text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">{row.name}</CardTitle>
                  </div>
                  {row.pinned && (
                    <Badge variant="secondary">{SAVED_SEARCHES_PINNED_STATUS_LABEL}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <CardDescription className="line-clamp-2">
                  {row.queryDescription}
                </CardDescription>
              </CardContent>
              <CardFooter className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.pinned}
                    onCheckedChange={() => onTogglePinned(row.id)}
                    aria-label={pinButtonLabel}
                  />
                  <span className="text-sm text-muted-foreground">
                    {row.pinned ? SAVED_SEARCHES_UNPINNED_STATUS_LABEL.replace("Not ", "") : SAVED_SEARCHES_PINNED_STATUS_LABEL.replace("Pinned", "Pin")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${SAVED_SEARCHES_RENAME_BUTTON_LABEL} for ${row.name}`}
                    onClick={() => onEdit(row)}
                  >
                    <Pencil />
                  </Button>
                  <Separator orientation="vertical" className="h-4" />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-destructive hover:text-destructive"
                    aria-label={`${SAVED_SEARCHES_DELETE_BUTTON_LABEL} ${row.name}`}
                    onClick={() => onDelete(row)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
