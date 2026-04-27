import fs from "node:fs"
import os from "node:os"
import path from "node:path"

async function setupTestSuiteRunRouteTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-suite-run-route-"))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import("@/lib/db")
  const db = getDb()
  const now = "2026-04-10T00:00:00.000Z"

  db.prepare(`
    INSERT INTO projects (
      id,
      name,
      description,
      business_description,
      business_goal,
      business_background,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("project-1", "Project 1", "", "", "", "", now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("prompt-a", "project-1", "Reply Prompt", "reply", "", "[]", "[]", 1, "active", now, now)

  db.prepare(`
    INSERT INTO test_suites (
      id,
      project_id,
      session_id,
      name,
      description,
      prompt_id,
      prompt_version_id,
      workflow_mode,
      routing_config,
      config,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "suite-1",
    "project-1",
    null,
    "Suite 1",
    "",
    "prompt-a",
    null,
    "single",
    null,
    JSON.stringify({
      provider: "openai",
      model: "gpt-test",
      apiKey: "test-key",
      baseUrl: "",
    }),
    "ready",
    now,
    now
  )

  db.prepare(`
    INSERT INTO test_cases (
      id,
      test_suite_id,
      title,
      context,
      input,
      expected_output,
      expected_output_diagnostics,
      expected_intent,
      sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "case-1",
    "suite-1",
    "Case 1",
    "",
    "hello",
    "world",
    null,
    null,
    0
  )

  return {
    db,
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe("test suite run route", () => {
  it("passes request.signal to runTestSuite so the current run can be aborted", async () => {
    const testContext = await setupTestSuiteRunRouteTest()
    const captured: { signal: AbortSignal | null } = { signal: null }

    vi.doMock("@/lib/ai/test-runner", () => ({
      runTestSuite: vi.fn(async function* (
        _runId: string,
        _suite: unknown,
        _cases: unknown,
        _prompt: unknown,
        options?: { signal?: AbortSignal }
      ) {
        captured.signal = options?.signal ?? null
        yield { type: "test-complete", data: { runId: "run-1", score: 100 } }
      }),
    }))

    try {
      const { POST } = await import("@/app/api/test-suites/[id]/run/route")
      const controller = new AbortController()
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ promptId: "prompt-a" }),
        signal: controller.signal,
      })

      const response = await POST(request as never, {
        params: Promise.resolve({ id: "suite-1" }),
      })

      await response.text()

      expect(captured.signal).toBe(request.signal)
    } finally {
      testContext.cleanup()
    }
  })

  it("loads ragPromptId prompts into routePrompts for R routes", async () => {
    const testContext = await setupTestSuiteRunRouteTest()
    const captured: { routePrompts: Record<string, { id: string }> | null } = { routePrompts: null }
    const now = "2026-04-23T00:00:00.000Z"

    testContext.db.prepare(`
      INSERT INTO prompts (
        id,
        project_id,
        title,
        content,
        description,
        tags,
        variables,
        version,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run("prompt-rag", "project-1", "RAG Reply", "Use this evidence:\n{rag_qas_text}", "", "[]", "[]", 1, "active", now, now)

    testContext.db.prepare(`
      UPDATE test_suites
      SET workflow_mode = ?, routing_config = ?, prompt_id = ?
      WHERE id = ?
    `).run(
      "routing",
      JSON.stringify({
        entryPromptId: "prompt-a",
        routes: [
          {
            intent: "R",
            promptId: "",
            targetType: "prompt",
            targetId: "",
            ragPromptId: "prompt-rag",
            ragIndexVersionId: "index-1",
          },
        ],
      }),
      null,
      "suite-1",
    )

    vi.doMock("@/lib/ai/test-runner", () => ({
      runTestSuite: vi.fn(async function* (
        _runId: string,
        _suite: unknown,
        _cases: unknown,
        _prompt: unknown,
        options?: { routePrompts?: Record<string, { id: string }> }
      ) {
        captured.routePrompts = options?.routePrompts ?? null
        yield { type: "test-complete", data: { runId: "run-1", score: 100 } }
      }),
    }))

    try {
      const { POST } = await import("@/app/api/test-suites/[id]/run/route")
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({}),
      })

      const response = await POST(request as never, {
        params: Promise.resolve({ id: "suite-1" }),
      })

      await response.text()

      expect(captured.routePrompts).toEqual({
        "prompt-rag": expect.objectContaining({
          id: "prompt-rag",
        }),
      })
    } finally {
      testContext.cleanup()
    }
  })
})
