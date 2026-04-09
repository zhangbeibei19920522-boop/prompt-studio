const {
  html2canvasMock,
  addImageMock,
  addPageMock,
  saveMock,
  htmlMock,
  jsPDFMock,
} = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  addImageMock: vi.fn(),
  addPageMock: vi.fn(),
  saveMock: vi.fn(),
  htmlMock: vi.fn(),
  jsPDFMock: vi.fn(),
}))

vi.mock("html2canvas", () => ({
  default: html2canvasMock,
}))

vi.mock("jspdf", () => ({
  jsPDF: jsPDFMock,
}))

import { exportTestRunPDF } from "@/lib/utils/pdf-export"

class MockElement {
  style = { cssText: "" }
  innerHTML = ""
}

describe("exportTestRunPDF", () => {
  beforeEach(() => {
    const children: MockElement[] = []
    const body = {
      appendChild: vi.fn((element: MockElement) => {
        children.push(element)
        return element
      }),
      removeChild: vi.fn((element: MockElement) => {
        const index = children.indexOf(element)
        if (index >= 0) children.splice(index, 1)
        return element
      }),
      get children() {
        return children
      },
    }

    vi.stubGlobal("document", {
      createElement: vi.fn(() => new MockElement()),
      body,
    })

    html2canvasMock.mockReset()
    addImageMock.mockReset()
    addPageMock.mockReset()
    saveMock.mockReset()
    htmlMock.mockReset()
    jsPDFMock.mockReset()

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
})
