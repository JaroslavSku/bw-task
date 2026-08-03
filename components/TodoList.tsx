"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { memo } from "react"
import { TodoItem } from "@/components/TodoItem"
import type { CategoryInfo } from "@/lib/categories"
import type { Priority, Todo } from "@/lib/schemas/todo"

export type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" }

interface TodoListProps {
  todos: Todo[]
  categories: CategoryInfo[]
  loadState: LoadState
  hasActiveFilters: boolean
  onRetry: () => void
  onToggle: (todoId: number, nextDone: boolean) => void
  onDelete: (todoId: number) => void
  onSaveText: (todoId: number, text: string) => void
  onChangePriority: (todoId: number, priority: Priority) => void
}

export const TodoList = memo(function TodoList({
  todos,
  categories,
  loadState,
  hasActiveFilters,
  onRetry,
  onToggle,
  onDelete,
  onSaveText,
  onChangePriority,
}: TodoListProps) {
  if (loadState.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-12 text-muted-foreground/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-medium uppercase tracking-widest">
          Loading Tasks...
        </p>
      </div>
    )
  }

  if (loadState.status === "error") {
    return (
      <div className="text-center py-12 border-2 border-dashed border-red-500/20 rounded-xl bg-red-500/5 space-y-3">
        <p className="text-red-300 text-sm">{loadState.message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl bg-white/5">
        <p className="text-muted-foreground">
          {hasActiveFilters
            ? "No tasks match your filters."
            : "No tasks yet. Add one above!"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          categories={categories}
          onToggle={onToggle}
          onDelete={onDelete}
          onSaveText={onSaveText}
          onChangePriority={onChangePriority}
        />
      ))}
    </div>
  )
})
