import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { TestSuiteRunStatus } from "@/components/test/test-suite-run-status"

describe("TestSuiteRunStatus", () => {
  it("renders evaluating status with evaluated progress", () => {
    const html = renderToStaticMarkup(
      <TestSuiteRunStatus
        progress={{
          status: "evaluating",
          completedCases: 4,
          evaluatedCases: 1,
          totalCases: 4,
        }}
      />
    )

    expect(html).toContain("评估中")
    expect(html).toContain("1/4")
    expect(html).toContain("width:25%")
  })
})
