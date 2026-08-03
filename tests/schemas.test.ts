import { describe, expect, it } from "vitest"
import { credentialsSchema } from "@/lib/schemas/auth"
import {
  createTodoSchema,
  todoFiltersSchema,
  todoIdSchema,
  updateTodoSchema,
} from "@/lib/schemas/todo"

describe("createTodoSchema", () => {
  it("accepts a minimal valid todo and fills defaults", () => {
    const result = createTodoSchema.parse({ text: "Buy milk" })
    expect(result).toEqual({
      text: "Buy milk",
      priority: "medium",
      category: "other",
    })
  })

  it("rejects an empty body", () => {
    expect(createTodoSchema.safeParse({}).success).toBe(false)
  })

  it("rejects blank text", () => {
    expect(createTodoSchema.safeParse({ text: "   " }).success).toBe(false)
  })

  it("rejects text over 500 characters", () => {
    expect(createTodoSchema.safeParse({ text: "x".repeat(501) }).success).toBe(
      false,
    )
  })

  it("rejects an unknown priority", () => {
    const result = createTodoSchema.safeParse({
      text: "x",
      priority: "SUPER-HACKER",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a malformed due date", () => {
    expect(
      createTodoSchema.safeParse({ text: "x", dueDate: "tomorrow" }).success,
    ).toBe(false)
  })
})

describe("updateTodoSchema", () => {
  it("accepts a partial patch", () => {
    expect(updateTodoSchema.parse({ done: true })).toEqual({ done: true })
  })

  it("rejects an empty patch", () => {
    expect(updateTodoSchema.safeParse({}).success).toBe(false)
  })

  it("allows clearing the due date with null", () => {
    expect(updateTodoSchema.parse({ dueDate: null })).toEqual({ dueDate: null })
  })
})

describe("todoFiltersSchema", () => {
  it("applies default paging", () => {
    const result = todoFiltersSchema.parse({})
    expect(result.limit).toBe(100)
    expect(result.offset).toBe(0)
  })

  it("caps the limit at 200", () => {
    expect(todoFiltersSchema.safeParse({ limit: "10000" }).success).toBe(false)
  })

  it("rejects an unknown status", () => {
    expect(todoFiltersSchema.safeParse({ status: "everything" }).success).toBe(
      false,
    )
  })
})

describe("todoIdSchema", () => {
  it("coerces a numeric string", () => {
    expect(todoIdSchema.parse("42")).toBe(42)
  })

  it("rejects a non-numeric id", () => {
    expect(todoIdSchema.safeParse("abc").success).toBe(false)
  })

  it("rejects zero and negative ids", () => {
    expect(todoIdSchema.safeParse("0").success).toBe(false)
    expect(todoIdSchema.safeParse("-5").success).toBe(false)
  })
})

describe("credentialsSchema", () => {
  it("accepts a valid email and password", () => {
    const result = credentialsSchema.parse({
      email: "user@example.com",
      password: "longenough",
    })
    expect(result.email).toBe("user@example.com")
  })

  it("rejects an invalid email", () => {
    expect(
      credentialsSchema.safeParse({ email: "nonsense", password: "longenough" })
        .success,
    ).toBe(false)
  })

  it("rejects a short password", () => {
    expect(
      credentialsSchema.safeParse({
        email: "user@example.com",
        password: "short",
      }).success,
    ).toBe(false)
  })
})
