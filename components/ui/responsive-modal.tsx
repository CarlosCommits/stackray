"use client"

import * as React from "react"
import { useSyncExternalStore } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

const DESKTOP_MODAL_QUERY = "(min-width: 768px)"

function subscribeToDesktopModal(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }

  const query = window.matchMedia(DESKTOP_MODAL_QUERY)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

function readDesktopModalSnapshot() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true
  }

  return window.matchMedia(DESKTOP_MODAL_QUERY).matches
}

function useIsDesktopModal() {
  return useSyncExternalStore(
    subscribeToDesktopModal,
    readDesktopModalSnapshot,
    () => true,
  )
}

const ResponsiveModalContext = React.createContext(true)

type ResponsiveModalDrawerProps = {
  direction?: "top" | "bottom" | "left" | "right"
  dismissible?: boolean
  modal?: boolean
  repositionInputs?: boolean
}

function ResponsiveModal({
  children,
  drawerProps,
  dialogProps,
  open,
  onOpenChange,
}: React.PropsWithChildren<
  Pick<React.ComponentProps<typeof Dialog>, "open" | "onOpenChange"> & {
    drawerProps?: ResponsiveModalDrawerProps
    dialogProps?: Omit<React.ComponentProps<typeof Dialog>, "children" | "open" | "onOpenChange">
  }
>) {
  const isDesktop = useIsDesktopModal()

  return (
    <ResponsiveModalContext.Provider value={isDesktop}>
      {isDesktop ? (
        <Dialog open={open} onOpenChange={onOpenChange} {...dialogProps}>
          {children}
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange} {...drawerProps}>
          {children}
        </Drawer>
      )}
    </ResponsiveModalContext.Provider>
  )
}

function useResponsiveModalContext() {
  return React.useContext(ResponsiveModalContext)
}

function ResponsiveModalTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  const isDesktop = useResponsiveModalContext()

  return isDesktop ? <DialogTrigger {...props} /> : <DrawerTrigger {...props} />
}

function ResponsiveModalContent({
  className,
  desktopClassName,
  mobileClassName,
  showCloseButton,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  desktopClassName?: string
  mobileClassName?: string
}) {
  const isDesktop = useResponsiveModalContext()

  if (isDesktop) {
    return (
      <DialogContent
        className={cn(className, desktopClassName)}
        showCloseButton={showCloseButton}
        {...props}
      />
    )
  }

  return (
    <DrawerContent
      className={cn(
        "border-[var(--gray-border)]/40 bg-[var(--surface-dark)] text-[var(--foreground)] ring-1 ring-white/8 data-[vaul-drawer-direction=bottom]:!max-h-[92svh]",
        className,
        mobileClassName,
      )}
      {...props}
    />
  )
}

function ResponsiveModalHeader(props: React.ComponentProps<typeof DialogHeader>) {
  const isDesktop = useResponsiveModalContext()

  return isDesktop ? <DialogHeader {...props} /> : <DrawerHeader {...props} />
}

function ResponsiveModalFooter(props: React.ComponentProps<typeof DialogFooter>) {
  const isDesktop = useResponsiveModalContext()

  return isDesktop ? <DialogFooter {...props} /> : <DrawerFooter {...props} />
}

function ResponsiveModalTitle(props: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useResponsiveModalContext()

  return isDesktop ? <DialogTitle {...props} /> : <DrawerTitle {...props} />
}

function ResponsiveModalDescription(props: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useResponsiveModalContext()

  return isDesktop ? <DialogDescription {...props} /> : <DrawerDescription {...props} />
}

export {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
}
