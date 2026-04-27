import fs from "node:fs"
import os from "node:os"
import path from "node:path"

type StoredTestRunResult = Record<string, unknown>

async function setupRunningSuiteProgressRouteTest(
  results: StoredTestRunResult[] = [
    {
      testCaseId: "case-1",
      actualOutput: "world",
      passed: false,
      score: 0,
      reason: "",
    },
  ]
) {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-suite-run-progress-route-"))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import("@/lib/db")
  const db = getDb()
  const now = "2026-04-23T00:00:00.000Z"

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
    INSERT INTO test_suites (
      id,
      project_id,
      section,
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
    "full-flow",
    "Running Suite",
    "",
    null,
    null,
    "single",
    null,
    JSON.stringify({ provider: "openai", model: "gpt-test", apiKey: "test-key", baseUrl: "" }),
    "running",
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
  `).run("case-1", "suite-1", "Case 1", "", "hello", "world", null, null, 0)

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
  `).run("case-2", "suite-1", "Case 2", "", "hello again", "world again", null, null, 1)

  db.prepare(`
    INSERT INTO test_runs (
      id,
      test_suite_id,
      status,
      results,
      report,
      score,
      started_at,
      completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "run-1",
    "suite-1",
    "running",
    JSON.stringify(results),
    "{}",
    null,
    now,
    null
  )

  return {
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe("test suite run progress route", () => {
  it("returns persisted progress for running suites in a project", async () => {
    const testContext = await setupRunningSuiteProgressRouteTest()

    try {
      const route = await import("@/app/api/projects/[id]/test-suite-run-progress/route")
      const response = await route.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "project-1" }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data).toEqual([
        expect.objectContaining({
          suiteId: "suite-1",
          runId: "run-1",
          status: "running",
          completedCases: 1,
          evaluatedCases: 0,
          totalCases: 2,
        }),
      ])
    } finally {
      testContext.cleanup()
    }
  })

  it("marks progress as evaluating once all cases have execution output", async () => {
    const testContext = await setupRunningSuiteProgressRouteTest([
      {
        testCaseId: "case-1",
        actualOutput: "world",
        passed: true,
        score: 90,
        reason: "ok",
      },
      {
        testCaseId: "case-2",
        actualOutput: "world again",
        passed: false,
        score: 0,
        reason: "",
      },
    ])

    try {
      const route = await import("@/app/api/projects/[id]/test-suite-run-progress/route")
      const response = await route.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "project-1" }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(payload.data).toEqual([
        expect.objectContaining({
          suiteId: "suite-1",
          runId: "run-1",
          status: "evaluating",
          completedCases: 2,
          evaluatedCases: 1,
          totalCases: 2,
        }),
      ])
    } finally {
      testContext.cleanup()
    }
  })
})
