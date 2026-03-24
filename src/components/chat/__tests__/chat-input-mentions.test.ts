import { describe, expect, test } from "vitest"

import {
  applyMentionSelection,
  findMentionMatch,
} from "../chat-input-mentions"

describe("findMentionMatch", () => {
  test("detects a mention at the cursor and returns its query", () => {
    expect(findMentionMatch("帮我看一下@订单", "帮我看一下@订单".length)).toEqual({
      start: 5,
      end: 8,
      query: "订单",
    })
  })

  test("does not treat email addresses as mentions", () => {
    expect(findMentionMatch("联系 foo@bar.com", "联系 foo@bar.com".length)).toBeNull()
  })
})

describe("applyMentionSelection", () => {
  test("removes the active @query and keeps surrounding text readable", () => {
    expect(
      applyMentionSelection("请参考 @退款流程 这个文档", {
        start: 4,
        end: 9,
        query: "退款流程",
      })
    ).toEqual({
      content: "请参考 这个文档",
      cursor: 4,
    })
  })
})
