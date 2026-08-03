import { z } from "zod"

export const prioritySchema = z.enum(["low", "medium", "high"])
export const categorySchema = z.enum([
  "personal",
  "work",
  "shopping",
  "health",
  "other",
])

const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a date in YYYY-MM-DD format")

export const todoSchema = z.object({
  id: z.number().int(),
  text: z.string().trim().min(1).max(500),
  done: z.boolean(),
  priority: prioritySchema,
  category: categorySchema,
  dueDate: dueDateSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
})

export const createTodoSchema = z.object({
  text: todoSchema.shape.text,
  priority: prioritySchema.default("medium"),
  category: categorySchema.default("other"),
  dueDate: dueDateSchema.nullish(),
})

export const updateTodoSchema = z
  .object({
    text: todoSchema.shape.text,
    priority: prioritySchema,
    category: categorySchema,
    dueDate: dueDateSchema.nullable(),
    done: z.boolean(),
  })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "at least one field is required",
  )

export const todoFiltersSchema = z.object({
  category: categorySchema.optional(),
  priority: prioritySchema.optional(),
  status: z.enum(["active", "completed"]).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const todoIdSchema = z.coerce.number().int().positive()

export type Todo = z.infer<typeof todoSchema>
export type Priority = z.infer<typeof prioritySchema>
export type Category = z.infer<typeof categorySchema>
export type CreateTodoInput = z.infer<typeof createTodoSchema>
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>
export type TodoFilters = z.infer<typeof todoFiltersSchema>
