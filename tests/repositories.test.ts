import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { closePool, getPool } from "@/lib/db"
import {
  createTodo,
  deleteTodo,
  getTodoStats,
  listTodos,
  updateTodo,
} from "@/lib/repositories/todos"
import { createUser, findUserByEmail } from "@/lib/repositories/users"
import { todoFiltersSchema } from "@/lib/schemas/todo"

const defaultFilters = todoFiltersSchema.parse({})

async function createTestUser(email: string): Promise<number> {
  const user = await createUser(email, "irrelevant-hash")
  if (!user) throw new Error(`could not create test user ${email}`)
  return user.id
}

beforeEach(async () => {
  await getPool().query("truncate table todos, users restart identity cascade")
})

afterAll(async () => {
  await closePool()
})

describe("users repository", () => {
  it("creates and finds a user by email", async () => {
    await createTestUser("alice@example.com")
    const foundUser = await findUserByEmail("alice@example.com")
    expect(foundUser?.email).toBe("alice@example.com")
  })

  it("returns null when the email is already taken", async () => {
    await createTestUser("alice@example.com")
    const duplicateUser = await createUser("alice@example.com", "another-hash")
    expect(duplicateUser).toBeNull()
  })
})

describe("todos repository", () => {
  it("creates a todo with all fields and reads it back", async () => {
    const userId = await createTestUser("alice@example.com")
    const createdTodo = await createTodo(userId, {
      text: "Water the plants",
      priority: "high",
      category: "personal",
      dueDate: "2026-08-15",
    })

    expect(createdTodo.text).toBe("Water the plants")
    expect(createdTodo.done).toBe(false)
    expect(createdTodo.dueDate).toBe("2026-08-15")

    const todos = await listTodos(userId, defaultFilters)
    expect(todos).toHaveLength(1)
    expect(todos[0]?.id).toBe(createdTodo.id)
  })

  it("marks a todo as done and sets completedAt", async () => {
    const userId = await createTestUser("alice@example.com")
    const createdTodo = await createTodo(userId, {
      text: "Task",
      priority: "low",
      category: "other",
    })

    const updatedTodo = await updateTodo(userId, createdTodo.id, { done: true })
    expect(updatedTodo?.done).toBe(true)
    expect(updatedTodo?.completedAt).toBeDefined()

    const reopenedTodo = await updateTodo(userId, createdTodo.id, {
      done: false,
    })
    expect(reopenedTodo?.done).toBe(false)
    expect(reopenedTodo?.completedAt).toBeUndefined()
  })

  it("never leaks todos between users", async () => {
    const aliceId = await createTestUser("alice@example.com")
    const bobId = await createTestUser("bob@example.com")
    const aliceTodo = await createTodo(aliceId, {
      text: "Alice task",
      priority: "low",
      category: "other",
    })
    await createTodo(bobId, {
      text: "Bob task",
      priority: "low",
      category: "other",
    })

    const aliceTodos = await listTodos(aliceId, defaultFilters)
    expect(aliceTodos).toHaveLength(1)
    expect(aliceTodos[0]?.text).toBe("Alice task")

    expect(await updateTodo(bobId, aliceTodo.id, { done: true })).toBeNull()
    expect(await deleteTodo(bobId, aliceTodo.id)).toBe(false)

    const aliceTodosAfter = await listTodos(aliceId, defaultFilters)
    expect(aliceTodosAfter[0]?.done).toBe(false)
  })

  it("filters by category, priority, status and search", async () => {
    const userId = await createTestUser("alice@example.com")
    await createTodo(userId, {
      text: "Buy groceries",
      priority: "medium",
      category: "shopping",
    })
    await createTodo(userId, {
      text: "Review pull requests",
      priority: "high",
      category: "work",
    })
    const doneTodo = await createTodo(userId, {
      text: "Call mom",
      priority: "low",
      category: "personal",
    })
    await updateTodo(userId, doneTodo.id, { done: true })

    const workTodos = await listTodos(userId, {
      ...defaultFilters,
      category: "work",
    })
    expect(workTodos.map((todo) => todo.text)).toEqual(["Review pull requests"])

    const highPriorityTodos = await listTodos(userId, {
      ...defaultFilters,
      priority: "high",
    })
    expect(highPriorityTodos).toHaveLength(1)

    const completedTodos = await listTodos(userId, {
      ...defaultFilters,
      status: "completed",
    })
    expect(completedTodos.map((todo) => todo.text)).toEqual(["Call mom"])

    const searchedTodos = await listTodos(userId, {
      ...defaultFilters,
      search: "groc",
    })
    expect(searchedTodos.map((todo) => todo.text)).toEqual(["Buy groceries"])
  })

  it("filters overdue todos by due date", async () => {
    const userId = await createTestUser("alice@example.com")
    await createTodo(userId, {
      text: "Overdue task",
      priority: "high",
      category: "work",
      dueDate: "2020-01-01",
    })
    const lateButDone = await createTodo(userId, {
      text: "Finished late",
      priority: "low",
      category: "work",
      dueDate: "2020-01-01",
    })
    await updateTodo(userId, lateButDone.id, { done: true })
    await createTodo(userId, {
      text: "Due far in the future",
      priority: "low",
      category: "work",
      dueDate: "2999-12-31",
    })
    await createTodo(userId, {
      text: "No due date",
      priority: "low",
      category: "work",
    })

    const overdueTodos = await listTodos(userId, {
      ...defaultFilters,
      status: "overdue",
    })
    expect(overdueTodos.map((todo) => todo.text)).toEqual(["Overdue task"])
  })

  it("treats like wildcards in search as literals", async () => {
    const userId = await createTestUser("alice@example.com")
    await createTodo(userId, {
      text: "Reach 100% coverage",
      priority: "low",
      category: "work",
    })
    await createTodo(userId, {
      text: "Reach 100x speedup",
      priority: "low",
      category: "work",
    })

    const searchedTodos = await listTodos(userId, {
      ...defaultFilters,
      search: "100%",
    })
    expect(searchedTodos.map((todo) => todo.text)).toEqual([
      "Reach 100% coverage",
    ])
  })

  it("respects limit and offset ordering by newest first", async () => {
    const userId = await createTestUser("alice@example.com")
    for (const label of ["first", "second", "third"]) {
      await createTodo(userId, {
        text: label,
        priority: "low",
        category: "other",
      })
    }

    const firstPage = await listTodos(userId, {
      ...defaultFilters,
      limit: 2,
      offset: 0,
    })
    expect(firstPage.map((todo) => todo.text)).toEqual(["third", "second"])

    const secondPage = await listTodos(userId, {
      ...defaultFilters,
      limit: 2,
      offset: 2,
    })
    expect(secondPage.map((todo) => todo.text)).toEqual(["first"])
  })

  it("computes stats in a single query", async () => {
    const userId = await createTestUser("alice@example.com")
    await createTodo(userId, {
      text: "Open task",
      priority: "low",
      category: "other",
    })
    await createTodo(userId, {
      text: "Overdue task",
      priority: "low",
      category: "other",
      dueDate: "2020-01-01",
    })
    const doneTodo = await createTodo(userId, {
      text: "Done task",
      priority: "low",
      category: "other",
    })
    await updateTodo(userId, doneTodo.id, { done: true })

    const stats = await getTodoStats(userId)
    expect(stats).toEqual({ total: 3, completed: 1, active: 2, overdue: 1 })
  })
})
