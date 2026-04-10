const {
  html2canvasMock,
  addImageMock,
  addPageMock,
  saveMock,
  htmlMock,
  jsPDFMock,
  createObjectURLMock,
  revokeObjectURLMock,
} = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  addImageMock: vi.fn(),
  addPageMock: vi.fn(),
  saveMock: vi.fn(),
  htmlMock: vi.fn(),
  jsPDFMock: vi.fn(),
  createObjectURLMock: vi.fn(),
  revokeObjectURLMock: vi.fn(),
}))

vi.mock("html2canvas", () => ({
  default: html2canvasMock,
}))

vi.mock("jspdf", () => ({
  jsPDF: jsPDFMock,
}))

import { exportTestRunHTML, exportTestRunPDF } from "@/lib/utils/pdf-export"

class MockElement {
  style = { cssText: "" }
  innerHTML = ""
}

class MockAnchorElement extends MockElement {
  href = ""
  download = ""
  click = vi.fn()
}

describe("exportTestRunPDF", () => {
  beforeEach(() => {
    const children: Array<MockElement | MockAnchorElement> = []
    const body = {
      appendChild: vi.fn((element: MockElement | MockAnchorElement) => {
        children.push(element)
        return element
      }),
      removeChild: vi.fn((element: MockElement | MockAnchorElement) => {
        const index = children.indexOf(element)
        if (index >= 0) children.splice(index, 1)
        return element
      }),
      get children() {
        return children
      },
    }

    vi.stubGlobal("document", {
      createElement: vi.fn((tagName?: string) => tagName === "a" ? new MockAnchorElement() : new MockElement()),
      body,
    })
    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })

    html2canvasMock.mockReset()
    addImageMock.mockReset()
    addPageMock.mockReset()
    saveMock.mockReset()
    htmlMock.mockReset()
    jsPDFMock.mockReset()
    createObjectURLMock.mockReset()
    revokeObjectURLMock.mockReset()

    html2canvasMock.mockResolvedValue({
      width: 794,
      height: 1600,
      toDataURL: () => "data:image/jpeg;base64,abc",
    })

    htmlMock.mockImplementation((_src, options?: { callback?: (doc: unknown) => void }) => {
      options?.callback?.({
        save: saveMock,
      })
      return {}
    })

    jsPDFMock.mockImplementation(function MockJsPdf() {
      return {
        addImage: addImageMock,
        addPage: addPageMock,
        save: saveMock,
        html: htmlMock,
      }
    })

    createObjectURLMock.mockReturnValue("blob:mock-report")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses paginated html rendering instead of a single long canvas image", async () => {
    const actualOutput = `actual-start-${"z".repeat(240)}-actual-end`

    await exportTestRunPDF({
      suiteName: "Long suite",
      testRun: {
        id: "run-1",
        testSuiteId: "suite-1",
        status: "completed",
        score: 95,
        results: [
          {
            testCaseId: "case-1",
            actualOutput,
            passed: true,
            score: 95,
            reason: "good",
          },
        ],
        report: {
          summary: "summary",
          totalCases: 1,
          passedCases: 1,
          score: 95,
          improvements: ["improvement"],
          details: "details",
        },
        startedAt: "2026-04-09T10:00:00.000Z",
        completedAt: "2026-04-09T10:10:00.000Z",
      },
      testCases: [
        {
          id: "case-1",
          testSuiteId: "suite-1",
          title: "Long case",
          context: "",
          input: "input",
          expectedIntent: null,
          expectedOutput: "expected",
          sortOrder: 0,
        },
      ],
    })

    expect(jsPDFMock).toHaveBeenCalledWith("p", "mm", "a4")
    expect(htmlMock).toHaveBeenCalledTimes(1)
    const [container, options] = htmlMock.mock.calls[0]
    expect(container.innerHTML).toContain(actualOutput)
    expect(options.autoPaging).toBe("text")
    expect(html2canvasMock).not.toHaveBeenCalled()
    expect(addImageMock).not.toHaveBeenCalled()
    expect(saveMock).toHaveBeenCalledTimes(1)
    expect(document.body.children).toHaveLength(0)
  })

  it("downloads a standalone html report file with report content", async () => {
    const startedAt = "2026-04-09T10:00:00.000Z"
    const completedAt = "2026-04-09T10:10:00.000Z"

    await exportTestRunHTML({
      suiteName: "HTML suite",
      testRun: {
        id: "run-html-1",
        testSuiteId: "suite-1",
        status: "completed",
        score: 91,
        results: [
          {
            testCaseId: "case-1",
            actualOutput: "actual html output",
            passed: true,
            score: 91,
            reason: "good",
          },
        ],
        report: {
          summary: "summary html",
          totalCases: 1,
          passedCases: 1,
          score: 91,
          improvements: ["improvement html"],
          details: "details html",
        },
        startedAt,
        completedAt,
      },
      testCases: [
        {
          id: "case-1",
          testSuiteId: "suite-1",
          title: "HTML case",
          context: "",
          input: "input html",
          expectedIntent: null,
          expectedOutput: "expected html",
          sortOrder: 0,
        },
      ],
    })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    const [blob] = createObjectURLMock.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    await expect(blob.text()).resolves.toContain("HTML suite")
    await expect(blob.text()).resolves.toContain("summary html")
    await expect(blob.text()).resolves.toContain("actual html output")

    const anchor = document.body.appendChild.mock.calls[0]?.[0] as MockAnchorElement
    expect(anchor.download).toMatch(/^HTML suite_运行报告_.*\.html$/)
    expect(anchor.href).toBe("blob:mock-report")
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-report")
    expect(document.body.children).toHaveLength(0)
  })
})
