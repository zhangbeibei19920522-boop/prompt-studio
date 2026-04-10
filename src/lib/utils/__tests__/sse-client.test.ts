import { streamTestRun } from "@/lib/utils/sse-client"

describe("streamTestRun", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("forwards the abort signal to the test-run fetch request", async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new ReadableStream({
        start(streamController) {
          streamController.enqueue(
            new TextEncoder().encode('data: {"type":"test-complete","data":{"runId":"run-1","score":88}}\n\n')
          )
          streamController.close()
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
        },
      }
    ))

    vi.stubGlobal("fetch", fetchMock)

    const events = []
    for await (const event of streamTestRun("suite-1", "prompt-a", { signal: controller.signal })) {
      events.push(event)
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test-suites/suite-1/run",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
      })
    )
    expect(events).toEqual([
      { type: "test-complete", data: { runId: "run-1", score: 88 } },
    ])
  })
})
