import { afterAll, describe, expect, it } from "vitest"
import { closePool, getPool } from "@/lib/db"
import {
  closeTodosListener,
  subscribeTodoChanges,
} from "@/lib/realtime/todosListener"

const notifyTimeoutMs = 2_000

function waitForChange(): {
  handler: () => void
  received: Promise<void>
} {
  let resolveReceived: () => void = () => undefined
  const received = new Promise<void>((resolve, reject) => {
    resolveReceived = resolve
    setTimeout(
      () => reject(new Error("notification did not arrive in time")),
      notifyTimeoutMs,
    )
  })

  return { handler: () => resolveReceived(), received }
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
    const { handler, received } = waitForChange()
    const unsubscribe = await subscribeTodoChanges(42, handler)

    try {
      await notifyUserId(42)
      await expect(received).resolves.toBeUndefined()
    } finally {
      unsubscribe()
    }
  })

  it("stops delivering after unsubscribe", async () => {
    let callCount = 0
    const unsubscribe = await subscribeTodoChanges(7, () => {
      callCount += 1
    })
    unsubscribe()

    const { handler, received } = waitForChange()
    const unsubscribeSecond = await subscribeTodoChanges(7, handler)

    try {
      await notifyUserId(7)
      await received
      expect(callCount).toBe(0)
    } finally {
      unsubscribeSecond()
    }
  })

  it("shares one connection between subscribers", async () => {
    const first = waitForChange()
    const second = waitForChange()
    const unsubscribeFirst = await subscribeTodoChanges(1, first.handler)
    const unsubscribeSecond = await subscribeTodoChanges(1, second.handler)

    try {
      await notifyUserId(1)
      await expect(
        Promise.all([first.received, second.received]),
      ).resolves.toEqual([undefined, undefined])
    } finally {
      unsubscribeFirst()
      unsubscribeSecond()
    }
  })

  it("never wakes a handler belonging to another user", async () => {
    let otherUserCalls = 0
    const unsubscribeOther = await subscribeTodoChanges(101, () => {
      otherUserCalls += 1
    })

    const { handler, received } = waitForChange()
    const unsubscribeTarget = await subscribeTodoChanges(102, handler)

    try {
      await notifyUserId(102)
      await received
      expect(otherUserCalls).toBe(0)
    } finally {
      unsubscribeTarget()
      unsubscribeOther()
    }
  })
})
