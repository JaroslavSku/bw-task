"use client"

import { AlertCircle, Calendar, Check, Tag, Trash2 } from "lucide-react"
import { memo, useState } from "react"
import { cn } from "@/lib/utils"
import type { CategoryInfo } from "@/lib/categories"
import type { Priority, Todo } from "@/lib/schemas/todo"

const priorityConfig: Record<
  Priority,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Low", color: "text-slate-400", bg: "bg-slate-400/10" },
  medium: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  high: { label: "High", color: "text-red-400", bg: "bg-red-400/10" },
}

function parseDueDate(dueDate: string): Date {
  return new Date(`${dueDate}T00:00:00`)
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.done) return false
  return parseDueDate(todo.dueDate) < startOfToday()
}

function formatDate(dueDate: string): string {
  const date = parseDueDate(dueDate)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return "Today"
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface TodoItemProps {
  todo: Todo
  categories: CategoryInfo[]
  onToggle: (todoId: number, nextDone: boolean) => void
  onDelete: (todoId: number) => void
  onSaveText: (todoId: number, text: string) => void
  onChangePriority: (todoId: number, priority: Priority) => void
}

export const TodoItem = memo(function TodoItem({
  todo,
  categories,
  onToggle,
  onDelete,
  onSaveText,
  onChangePriority,
}: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)

  const categoryInfo = categories.find(
    (candidate) => candidate.id === todo.category,
  )
  const categoryColor = categoryInfo?.color ?? "#6b7280"
  const overdue = isOverdue(todo)

  const pending = todo.id < 0

  const startEditing = () => {
    if (pending) return
    setEditText(todo.text)
    setEditing(true)
  }

  const saveEdit = () => {
    const trimmedText = editText.trim()
    if (!trimmedText) return
    setEditing(false)
    if (trimmedText !== todo.text) {
      onSaveText(todo.id, trimmedText)
    }
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-200",
        overdue
          ? "bg-red-500/10 border-red-500/30"
          : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20",
        pending && "opacity-60",
      )}
    >
      <button
        onClick={() => onToggle(todo.id, !todo.done)}
        disabled={pending}
        className={cn(
          "flex-shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-300",
          todo.done
            ? "bg-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
            : "border-muted-foreground hover:border-white",
        )}
      >
        {todo.done && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && saveEdit()}
              maxLength={500}
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              autoFocus
            />
            <button
              onClick={saveEdit}
              className="text-green-400 hover:text-green-300 text-sm"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-muted-foreground hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div
              onClick={startEditing}
              className={cn(
                "text-sm font-medium cursor-pointer transition-colors",
                todo.done
                  ? "text-muted-foreground line-through decoration-white/20"
                  : "text-foreground hover:text-violet-300",
              )}
            >
              {todo.text}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                <Tag className="w-3 h-3" />
                {categoryInfo?.label ?? todo.category}
              </span>

              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                  priorityConfig[todo.priority].bg,
                  priorityConfig[todo.priority].color,
                )}
              >
                {priorityConfig[todo.priority].label}
              </span>

              {todo.dueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs",
                    overdue ? "text-red-400" : "text-muted-foreground",
                  )}
                >
                  {overdue ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Calendar className="w-3 h-3" />
                  )}
                  {formatDate(todo.dueDate)}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <select
          value={todo.priority}
          onChange={(event) =>
            onChangePriority(todo.id, event.target.value as Priority)
          }
          onClick={(event) => event.stopPropagation()}
          disabled={pending}
          className="bg-white/10 border-0 rounded text-xs py-1 px-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={() => onDelete(todo.id)}
          disabled={pending}
          className="p-1.5 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-400 transition-colors disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
})
