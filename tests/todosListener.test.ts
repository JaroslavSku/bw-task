import { afterAll, describe, expect, it } from "vitest"
import { closePool, getPool } from "@/lib/db"
import {
  closeTodosListener,
  subscribeTodoChanges,
} from "@/lib/realtime/todosListener"

const notifyTimeoutMs = 2_000

function waitForUserId(expectedUserId: number): {
  handler: (userId: number) => void
  received: Promise<number>
} {
  let resolveReceived: (userId: number) => void = () => undefined
  const received = new Promise<number>((resolve, reject) => {
    resolveReceived = resolve
    setTimeout(
      () => reject(new Error("notification did not arrive in time")),
      notifyTimeoutMs,
    )
  })

  return {
    handler: (userId) => {
      if (userId === expectedUserId) {
        resolveReceived(userId)
      }
    },
    received,
  }
}

async function notifyUserId(userId: number): Promise<void> {
  await getPool().query(
    "select pg_notify('todos_changed', json_build_object('userId', $1::int)::text)",
    [userId],
  )
}

afterAll(async () => {
  await closeTodosListener()
  await closePool()
})

describe("todos listener", () => {
  it("delivers a notification to a subscribed handler", async () => {
    const { handler, received } = waitForUserId(42)
    const unsubscribe = await subscribeTodoChanges(handler)

    try {
      await notifyUserId(42)
      expect(await received).toBe(42)
    } finally {
      unsubscribe()
    }
  })

  it("stops delivering after unsubscribe", async () => {
    let callCount = 0
    const unsubscribe = await subscribeTodoChanges(() => {
      callCount += 1
    })
    unsubscribe()

    const { handler, received } = waitForUserId(7)
    const unsubscribeSecond = await subscribeTodoChanges(handler)

    try {
      await notifyUserId(7)
      await received
      expect(callCount).toBe(0)
    } finally {
      unsubscribeSecond()
    }
  })

  it("shares one connection between subscribers", async () => {
    const first = waitForUserId(1)
    const second = waitForUserId(1)
    const unsubscribeFirst = await subscribeTodoChanges(first.handler)
    const unsubscribeSecond = await subscribeTodoChanges(second.handler)

    try {
      await notifyUserId(1)
      expect(await Promise.all([first.received, second.received])).toEqual([
        1, 1,
      ])
    } finally {
      unsubscribeFirst()
      unsubscribeSecond()
    }
  })
})
