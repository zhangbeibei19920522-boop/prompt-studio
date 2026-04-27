import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { TestSuiteGenerationStatus } from "@/components/test/test-suite-generation-status"

describe("TestSuiteGenerationStatus", () => {
  it("renders running progress with count summary", () => {
    const html = renderToStaticMarkup(
      <TestSuiteGenerationStatus
        job={{
          status: "running",
          generatedCount: 3,
          totalCount: 8,
          errorMessage: null,
        }}
      />
    )

    expect(html).toContain("生成中")
    expect(html).toContain("3/8")
    expect(html).toContain("width:37.5%")
  })

  it("renders a visible in-progress bar even before the first case is generated", () => {
    const html = renderToStaticMarkup(
      <TestSuiteGenerationStatus
        job={{
          status: "running",
          generatedCount: 0,
          totalCount: 8,
          errorMessage: null,
        }}
      />
    )

    expect(html).toContain("生成中")
    expect(html).toContain("0/8")
    expect(html).toContain("width:36%")
    expect(html).toContain("animate-pulse")
  })

  it("renders failed state with error message", () => {
    const html = renderToStaticMarkup(
      <TestSuiteGenerationStatus
        job={{
          status: "failed",
          generatedCount: 1,
          totalCount: 6,
          errorMessage: "模型返回了空结果",
        }}
      />
    )

    expect(html).toContain("生成失败")
    expect(html).toContain("模型返回了空结果")
  })
})
