import { getPool } from "@/lib/db"
import type {
  CreateTodoInput,
  Todo,
  TodoFilters,
  UpdateTodoInput,
} from "@/lib/schemas/todo"
import type { TodoStats } from "@/lib/types"

interface TodoRow {
  id: number
  text: string
  done: boolean
  priority: Todo["priority"]
  category: Todo["category"]
  due_date: string | null
  created_at: Date
  completed_at: Date | null
}

const todoColumns =
  "id, text, done, priority, category, due_date, created_at, completed_at"

function mapTodoRow(row: TodoRow): Todo {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    priority: row.priority,
    category: row.category,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  }
}

function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export async function listTodos(
  userId: number,
  filters: TodoFilters,
): Promise<Todo[]> {
  const conditions = ["user_id = $1"]
  const values: unknown[] = [userId]

  if (filters.category) {
    values.push(filters.category)
    conditions.push(`category = $${values.length}`)
  }
  if (filters.priority) {
    values.push(filters.priority)
    conditions.push(`priority = $${values.length}`)
  }
  if (filters.status === "active") {
    conditions.push("done = false")
  }
  if (filters.status === "completed") {
    conditions.push("done = true")
  }
  if (filters.search) {
    values.push(`%${escapeLikePattern(filters.search)}%`)
    conditions.push(`text ilike $${values.length}`)
  }

  values.push(filters.limit, filters.offset)

  const result = await getPool().query<TodoRow>(
    `select ${todoColumns} from todos
         where ${conditions.join(" and ")}
         order by created_at desc, id desc
         limit $${values.length - 1} offset $${values.length}`,
    values,
  )
  return result.rows.map(mapTodoRow)
}

export async function getTodoStats(userId: number): Promise<TodoStats> {
  const result = await getPool().query<TodoStats>(
    `select
             count(*)::int as total,
             count(*) filter (where done)::int as completed,
             count(*) filter (where not done)::int as active,
             count(*) filter (where not done and due_date < current_date)::int as overdue
         from todos
         where user_id = $1`,
    [userId],
  )
  return result.rows[0] ?? { total: 0, completed: 0, active: 0, overdue: 0 }
}

export async function createTodo(
  userId: number,
  input: CreateTodoInput,
): Promise<Todo> {
  const result = await getPool().query<TodoRow>(
    `insert into todos (user_id, text, priority, category, due_date)
         values ($1, $2, $3, $4, $5)
         returning ${todoColumns}`,
    [userId, input.text, input.priority, input.category, input.dueDate ?? null],
  )
  const row = result.rows[0]
  if (!row) {
    throw new Error("insert into todos returned no row")
  }
  return mapTodoRow(row)
}

export async function updateTodo(
  userId: number,
  todoId: number,
  patch: UpdateTodoInput,
): Promise<Todo | null> {
  const assignments: string[] = []
  const values: unknown[] = [userId, todoId]

  if (patch.text !== undefined) {
    values.push(patch.text)
    assignments.push(`text = $${values.length}`)
  }
  if (patch.priority !== undefined) {
    values.push(patch.priority)
    assignments.push(`priority = $${values.length}`)
  }
  if (patch.category !== undefined) {
    values.push(patch.category)
    assignments.push(`category = $${values.length}`)
  }
  if (patch.dueDate !== undefined) {
    values.push(patch.dueDate)
    assignments.push(`due_date = $${values.length}`)
  }
  if (patch.done !== undefined) {
    values.push(patch.done)
    assignments.push(`done = $${values.length}`)
    assignments.push(
      `completed_at = case when $${values.length} then now() else null end`,
    )
  }

  const result = await getPool().query<TodoRow>(
    `update todos
         set ${assignments.join(", ")}
         where user_id = $1 and id = $2
         returning ${todoColumns}`,
    values,
  )
  const row = result.rows[0]
  return row ? mapTodoRow(row) : null
}

export async function deleteTodo(
  userId: number,
  todoId: number,
): Promise<boolean> {
  const result = await getPool().query(
    "delete from todos where user_id = $1 and id = $2",
    [userId, todoId],
  )
  return (result.rowCount ?? 0) > 0
}
