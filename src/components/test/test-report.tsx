"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TestReport } from "@/types/database"

interface TestReportViewProps {
  report: TestReport
}

export function TestReportView({ report }: TestReportViewProps) {
  const passRate = report.totalCases > 0
    ? Math.round((report.passedCases / report.totalCases) * 100)
    : 0

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">测试报告</h3>

      {/* Overview */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{report.score}</p>
              <p className="text-xs text-muted-foreground">总分</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {report.passedCases}/{report.totalCases}
              </p>
              <p className="text-xs text-muted-foreground">通过率</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{passRate}%</p>
              <p className="text-xs text-muted-foreground">通过百分比</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {report.summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">总结</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Improvements */}
      {report.improvements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">改进建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {report.improvements.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Details */}
      {report.details && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">详细信息</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {report.details}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
