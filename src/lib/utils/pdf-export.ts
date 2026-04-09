import { jsPDF } from "jspdf"
import { format } from "date-fns"
import type { TestRun, TestCase, TestCaseResult, TestReport } from "@/types/database"

interface ExportParams {
  suiteName: string
  testRun: TestRun
  testCases: TestCase[]
}

const PDF_PAGE_MARGIN_MM = 10
const PDF_PAGE_WIDTH_MM = 210
const REPORT_WIDTH_PX = 794
const PDF_CONTENT_WIDTH_MM = PDF_PAGE_WIDTH_MM - PDF_PAGE_MARGIN_MM * 2

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildScoreColor(score: number): string {
  if (score >= 80) return "#16a34a"
  if (score >= 50) return "#ca8a04"
  return "#dc2626"
}

function buildOverviewHtml(report: TestReport): string {
  const passRate = report.totalCases > 0
    ? Math.round((report.passedCases / report.totalCases) * 100)
    : 0
  return `
    <div style="display:flex;gap:24px;margin-bottom:24px;">
      <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:8px;">
        <div style="font-size:28px;font-weight:bold;color:${buildScoreColor(report.score)}">${report.score}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">总分</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:8px;">
        <div style="font-size:28px;font-weight:bold;">${report.passedCases}/${report.totalCases}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">通过</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px;background:#f9fafb;border-radius:8px;">
        <div style="font-size:28px;font-weight:bold;">${passRate}%</div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">通过率</div>
      </div>
    </div>`
}

export function buildCaseRowHtml(
  index: number,
  tc: TestCase,
  result: TestCaseResult | undefined
): string {
  const passed = result?.passed
  const statusIcon = passed === true ? "✅" : passed === false ? "❌" : "—"
  const scoreText = result ? `${result.score}分` : "—"
  const scoreColor = result ? buildScoreColor(result.score) : "#6b7280"

  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;break-inside:auto;page-break-inside:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-weight:600;font-size:14px;">${statusIcon} #${index + 1} ${escapeHtml(tc.title)}</div>
        <div style="font-weight:bold;color:${scoreColor};font-size:14px;">${scoreText}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">输入</div>
          <div style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(tc.input)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">期望输出</div>
          <div style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(tc.expectedOutput)}</div>
        </div>
      </div>
      ${(tc.expectedIntent || result?.actualIntent || result?.matchedPromptTitle || result?.matchedPromptId) ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">期望 intent</div>
          <div style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(tc.expectedIntent ?? "未配置")}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">实际 intent</div>
          <div style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(result?.actualIntent ?? "未识别")}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">命中 Prompt</div>
          <div style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(result?.matchedPromptTitle ?? result?.matchedPromptId ?? "未命中")}</div>
        </div>
      </div>` : ""}
      ${result ? `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">实际输出</div>
        <div style="font-size:12px;background:#f0fdf4;padding:8px;border-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(result.actualOutput)}</div>
      </div>
      ${(result.intentReason || result.replyReason) ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">路由评估</div>
          <div style="font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(result.intentReason ?? "无")}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">回复评估</div>
          <div style="font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(result.replyReason ?? "无")}</div>
        </div>
      </div>` : ""}
      ${result.reason ? `
      <div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">评估理由</div>
        <div style="font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(result.reason)}</div>
      </div>` : ""}` : ""}
    </div>`
}

function buildReportHtml(report: TestReport): string {
  let html = ""
  if (report.summary) {
    html += `
    <div style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">总结</div>
      <div style="font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(report.summary)}</div>
    </div>`
  }
  if (report.improvements.length > 0) {
    html += `
    <div style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">改进建议</div>
      <ul style="margin:0;padding-left:20px;">
        ${report.improvements.map(item => `<li style="font-size:12px;color:#374151;margin-bottom:4px;">${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>`
  }
  if (report.details) {
    html += `
    <div style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;margin-bottom:6px;">详细信息</div>
      <div style="font-size:12px;color:#374151;white-space:pre-wrap;">${escapeHtml(report.details)}</div>
    </div>`
  }
  return html
}

function buildExportHtml({
  suiteName,
  runTime,
  overviewHtml,
  casesHtml,
  reportHtml,
  testCasesCount,
}: {
  suiteName: string
  runTime: string
  overviewHtml: string
  casesHtml: string
  reportHtml: string
  testCasesCount: number
}): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111827;background:white;">
      <h1 style="font-size:20px;margin:0 0 4px 0;">${escapeHtml(suiteName)} — 测试报告</h1>
      <div style="font-size:12px;color:#6b7280;margin-bottom:24px;">运行时间：${runTime}</div>
      ${overviewHtml}
      <h2 style="font-size:16px;margin:0 0 12px 0;">测试用例 (${testCasesCount})</h2>
      ${casesHtml}
      ${reportHtml ? `<h2 style="font-size:16px;margin:24px 0 12px 0;">测试报告</h2>${reportHtml}` : ""}
    </div>`
}

export async function exportTestRunPDF(
  { suiteName, testRun, testCases }: ExportParams
): Promise<void> {
  const runTime = testRun.completedAt
    ? format(new Date(testRun.completedAt), "yyyy-MM-dd HH:mm")
    : format(new Date(testRun.startedAt), "yyyy-MM-dd HH:mm")

  const casesHtml = testCases.map((tc, i) => {
    const result = testRun.results.find(r => r.testCaseId === tc.id)
    return buildCaseRowHtml(i, tc, result)
  }).join("")

  const reportHtml = testRun.report
    ? buildReportHtml(testRun.report) : ""
  const overviewHtml = testRun.report
    ? buildOverviewHtml(testRun.report) : ""

  const html = buildExportHtml({
    suiteName,
    runTime,
    overviewHtml,
    casesHtml,
    reportHtml,
    testCasesCount: testCases.length,
  })

  const container = document.createElement("div")
  container.style.cssText =
    `position:absolute;left:-9999px;top:0;width:${REPORT_WIDTH_PX}px;background:white;`
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const pdf = new jsPDF("p", "mm", "a4")
    const fileName = `${suiteName}_运行报告_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`

    await new Promise<void>((resolve, reject) => {
      try {
        pdf.html(container, {
          margin: [PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM, PDF_PAGE_MARGIN_MM],
          autoPaging: "text",
          width: PDF_CONTENT_WIDTH_MM,
          windowWidth: REPORT_WIDTH_PX,
          html2canvas: {
            backgroundColor: "#ffffff",
            scale: 1,
            useCORS: true,
            onclone: (clonedDoc) => {
              clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => el.remove())
            },
          },
          callback: (doc) => {
            doc.save(fileName)
            resolve()
          },
        })
      } catch (error) {
        reject(error)
      }
    })
  } finally {
    document.body.removeChild(container)
  }
}
