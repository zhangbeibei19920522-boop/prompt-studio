import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricCard({
  label,
  value,
  helper,
  tone,
  size = "default",
}: {
  label: string
  value: string
  helper: string
  tone: "blue" | "amber" | "green" | "rose"
  size?: "default" | "compact" | "mini"
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  }[tone]
  const compact = size === "compact"
  const mini = size === "mini"

  return (
    <Card className={cn("rounded-lg shadow-none", mini ? "py-2" : compact ? "py-3" : "py-5")}>
      <CardContent className={cn(mini ? "space-y-1.5 px-3" : compact ? "space-y-2 px-4" : "space-y-3 px-5")}>
        <div className={cn("inline-flex rounded-md border px-2 text-xs font-medium", mini ? "py-0" : compact ? "py-0.5" : "py-1", toneClass)}>
          {label}
        </div>
        <p className={cn("font-semibold", mini ? "text-lg" : compact ? "text-xl" : "text-2xl")}>{value}</p>
        <p className={cn("text-muted-foreground", mini ? "text-xs leading-4" : compact ? "text-xs leading-5" : "text-sm leading-6")}>{helper}</p>
      </CardContent>
    </Card>
  )
}
