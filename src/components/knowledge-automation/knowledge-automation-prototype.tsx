"use client"

import { useState } from "react"

import { CreateView } from "./create-view"
import { DetailView } from "./detail-view"
import { ListView } from "./list-view"
import { PrototypeShell } from "./prototype-shell"
import {
  getCustomer,
  type CustomerId,
  type DetailMode,
  type DetailState,
  type DetailTab,
  type PrototypeView,
} from "./prototype-data"

export function KnowledgeAutomationPrototype() {
  const [customerId, setCustomerId] = useState<CustomerId>("acme")
  const [view, setView] = useState<PrototypeView>("list")
  const [detailState, setDetailState] = useState<DetailState>("risk")
  const [detailMode, setDetailMode] = useState<DetailMode>("candidate")
  const [activeTab, setActiveTab] = useState<DetailTab>("risk")
  const customer = getCustomer(customerId)

  function openDetail(nextState: DetailState = "risk") {
    setDetailState(nextState)
    setDetailMode(nextState === "indexed" ? "stg" : nextState === "ready" ? "history" : "candidate")
    setActiveTab(nextState === "ready" || nextState === "indexed" ? "recall" : "risk")
    setView("detail")
  }

  function handleCustomerChange(nextCustomerId: CustomerId) {
    setCustomerId(nextCustomerId)
    setView("list")
    setDetailState("risk")
    setDetailMode("candidate")
    setActiveTab("risk")
  }

  return (
    <PrototypeShell customer={customer} onCustomerChange={handleCustomerChange}>
      <div aria-live="polite" className="sr-only">
        当前页面：{view}
      </div>
      {view === "list" && (
        <ListView customer={customer} onCreate={() => setView("create")} onOpenDetail={() => openDetail()} />
      )}
      {view === "create" && (
        <CreateView customer={customer} onBack={() => setView("list")} onSubmit={() => openDetail("risk")} />
      )}
      {view === "detail" && (
        <DetailView
          customer={customer}
          detailState={detailState}
          detailMode={detailMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => setView("list")}
          onSetState={setDetailState}
        />
      )}
    </PrototypeShell>
  )
}
