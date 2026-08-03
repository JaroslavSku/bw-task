"use client"

import { memo, useState } from "react"
import type { CategoryInfo } from "@/lib/categories"
import type { Category, Priority } from "@/lib/schemas/todo"

export interface NewTodoInput {
  text: string
  priority: Priority
  category: Category
  dueDate?: string
}

interface AddTodoFormProps {
  categories: CategoryInfo[]
  onSubmit: (input: NewTodoInput) => void
  onCancel: () => void
}

export const AddTodoForm = memo(function AddTodoForm({
  categories,
  onSubmit,
  onCancel,
}: AddTodoFormProps) {
  const [text, setText] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [category, setCategory] = useState<Category>("other")
  const [dueDate, setDueDate] = useState("")

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedText = text.trim()
    if (!trimmedText) return

    onSubmit({
      text: trimmedText,
      priority,
      category,
      dueDate: dueDate || undefined,
    })
    setText("")
    setPriority("medium")
    setCategory("other")
    setDueDate("")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="What needs to be done?"
        maxLength={500}
        className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 [&>option]:bg-muted [&>option]:text-foreground"
        >
          {categories.map((categoryInfo) => (
            <option key={categoryInfo.id} value={categoryInfo.id}>
              {categoryInfo.label}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 [&>option]:bg-muted [&>option]:text-foreground"
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 [&>option]:bg-muted [&>option]:text-foreground"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50 transition-all"
        >
          Add Task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-white/10 text-muted-foreground hover:bg-white/5 transition-all text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
})
