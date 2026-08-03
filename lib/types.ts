import type { CategoryInfo } from "@/lib/categories"
import type { Todo } from "@/lib/schemas/todo"

export interface TodoStats {
  total: number
  completed: number
  active: number
  overdue: number
}

export interface TodosResponse {
  todos: Todo[]
  categories: CategoryInfo[]
  stats: TodoStats
}
