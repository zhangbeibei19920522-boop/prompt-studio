"use client"

import { AppProvider } from "@/lib/store/app-context"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppProvider>{children}</AppProvider>
}
