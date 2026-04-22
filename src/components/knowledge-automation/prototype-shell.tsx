import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { customers, navItems, type CustomerId, type CustomerState } from "./prototype-data"

export function PrototypeShell({
  customer,
  onCustomerChange,
  children,
}: {
  customer: CustomerState
  onCustomerChange: (customerId: CustomerId) => void
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="grid min-h-screen grid-cols-[220px_minmax(0,1fr)] max-lg:grid-cols-1">
        <aside className="border-r border-slate-200 bg-white px-4 py-5 max-lg:hidden">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
              PS
            </div>
            <div>
              <p className="text-sm font-semibold">Prompt Studio</p>
              <p className="text-xs text-slate-500">Ops workspace</p>
            </div>
          </div>
          <nav className="space-y-1" aria-label="主导航">
            {navItems.map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
                  item === "知识库自动化"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">机器人管理 / 知识库自动化</p>
                <h1 className="mt-1 text-xl font-semibold">知识库清洗与索引</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  当前客户
                  <select
                    value={customer.id}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-slate-400"
                    onChange={(event) => onCustomerChange(event.target.value as CustomerId)}
                  >
                    {customers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Badge variant="outline" className="rounded-md border-slate-200 bg-white text-slate-700">
                  {customer.hasKnowledgeBase ? customer.knowledgeBaseName : "尚未创建知识库"}
                </Badge>
                <Badge variant={customer.currentVersion ? "default" : "secondary"} className="rounded-md">
                  {customer.currentVersion ? `当前索引：${customer.currentVersion}` : "暂无可用索引"}
                </Badge>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-6 py-6">{children}</div>
        </section>
      </div>
    </main>
  )
}
