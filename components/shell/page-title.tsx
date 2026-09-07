"use client"

import { createContext, useContext, useEffect, useState } from "react"

const PageTitleValueContext = createContext<string | null>(null)
const PageTitleSetterContext = createContext<((title: string | null) => void) | null>(null)

export function PageTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState<string | null>(null)

  return (
    <PageTitleSetterContext.Provider value={setTitle}>
      <PageTitleValueContext.Provider value={title}>
        {children}
      </PageTitleValueContext.Provider>
    </PageTitleSetterContext.Provider>
  )
}

export function PageTitle({ value }: { value: string }) {
  const setTitle = useContext(PageTitleSetterContext)

  useEffect(() => {
    setTitle?.(value)
    return () => setTitle?.(null)
  }, [setTitle, value])

  return null
}

export function usePageTitle() {
  return useContext(PageTitleValueContext)
}
