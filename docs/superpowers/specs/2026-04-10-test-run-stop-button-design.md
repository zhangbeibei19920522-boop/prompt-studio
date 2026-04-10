# Test Run Stop Button Design

## Goal

在测试模块里为当前页面发起的测试运行增加“停止测试”按钮，点击后立即中断当前这一次测试运行。

## Scope

- 前端在测试运行期间展示“停止测试”按钮。
- 前端使用 `AbortController` 中断当前测试运行请求。
- 后端通过 `request.signal` 感知中断，并尽快终止当前运行。
- 运行被停止后，将 `test_runs.status` 标记为 `failed`，并将 `test_suites.status` 恢复为 `ready`。

## Non-Goals

- 不提供“停止所有运行中测试”的全局能力。
- 不新增独立的 `/stop` API。
- 不新增 `cancelled` 状态枚举，本次沿用 `failed` + “用户已停止测试”语义。

## Architecture

- `TestSuiteDetail` 持有当前运行请求的 `AbortController`，运行中显示“停止测试”按钮。
- `streamTestRun(...)` 支持接收 `AbortSignal` 并透传给 `fetch`。
- `POST /api/test-suites/[id]/run` 把 `request.signal` 传给 `runTestSuite(...)`。
- `runTestSuite(...)`、执行器和 provider 透传 `AbortSignal`，在 case 执行和评估阶段都支持尽快中止。

## Verification

- 组件测试覆盖停止按钮和前端 abort 接线。
- `sse-client` 测试覆盖 `signal` 透传。
- route 测试覆盖 `request.signal` 向 runner 透传。
- runner 测试覆盖中断后将 run 标记为 failed、suite 恢复 ready。
