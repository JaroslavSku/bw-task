"use client"

import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Calendar,
  Check,
  Filter,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"

type Priority = "low" | "medium" | "high"
type Category = "personal" | "work" | "shopping" | "health" | "other"

interface Todo {
  id: number
  text: string
  done: boolean
  priority: Priority
  category: Category
  dueDate?: string
  createdAt: string
  completedAt?: string
}

interface CategoryInfo {
  id: Category
  label: string
  color: string
}

interface Stats {
  total: number
  completed: number
  active: number
  overdue: number
}

const priorityConfig = {
  low: {
    label: "Low",
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400/30",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
  },
  high: {
    label: "High",
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
  },
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [stats, setStats] = useState<Stats>({
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
  })
  const [loading, setLoading] = useState(true)

  // Form state
  const [text, setText] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [category, setCategory] = useState<Category>("other")
  const [dueDate, setDueDate] = useState("")
  const [showForm, setShowForm] = useState(false)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all")
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "completed"
  >("all")
  const [showFilters, setShowFilters] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")

  const fetchTodos = () => {
    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterPriority !== "all") params.set("priority", filterPriority)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (searchQuery) params.set("search", searchQuery)

    fetch(`/api/todos?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setTodos(data.todos)
        setCategories(data.categories)
        setStats(data.stats)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTodos()
  }, [filterCategory, filterPriority, filterStatus, searchQuery])

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    const tempId = Date.now()
    const newTodo: Todo = {
      id: tempId,
      text,
      done: false,
      priority,
      category,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
    }
    setTodos((prev) => [...prev, newTodo])
    setText("")
    setDueDate("")
    setPriority("medium")
    setCategory("other")
    setShowForm(false)

    fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        priority,
        category,
        dueDate: dueDate || undefined,
      }),
    })
      .then((res) => res.json())
      .then((created) => {
        setTodos((prev) => prev.map((t) => (t.id === tempId ? created : t)))
        setStats((s) => ({ ...s, total: s.total + 1, active: s.active + 1 }))
      })
  }

  const toggleTodo = (id: number) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    setTodos((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              done: !t.done,
              completedAt: !t.done ? new Date().toISOString() : undefined,
            }
          : t
      )
    )
    setStats((s) => ({
      ...s,
      completed: todo.done ? s.completed - 1 : s.completed + 1,
      active: todo.done ? s.active + 1 : s.active - 1,
    }))

    fetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, toggleDone: true }),
    })
  }

  const deleteTodo = (id: number) => {
    const todo = todos.find((t) => t.id === id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
    if (todo) {
      setStats((s) => ({
        ...s,
        total: s.total - 1,
        completed: todo.done ? s.completed - 1 : s.completed,
        active: !todo.done ? s.active - 1 : s.active,
      }))
    }

    fetch(`/api/todos?id=${id}`, { method: "DELETE" })
  }

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  const saveEdit = (id: number) => {
    if (!editText.trim()) return

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: editText } : t))
    )
    setEditingId(null)

    fetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text: editText }),
    })
  }

  const updateTodoPriority = (id: number, newPriority: Priority) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: newPriority } : t))
    )

    fetch("/api/todos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority: newPriority }),
    })
  }

  const isOverdue = (todo: Todo) => {
    if (!todo.dueDate || todo.done) return false
    return new Date(todo.dueDate) < new Date()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return "Today"
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const getCategoryColor = (cat: Category) => {
    return categories.find((c) => c.id === cat)?.color || "#6b7280"
  }

  const activeFiltersCount = [
    filterCategory !== "all",
    filterPriority !== "all",
    filterStatus !== "all",
    searchQuery !== "",
  ].filter(Boolean).length

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="relative w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="glass-card rounded-2xl p-8">
          {/* Header */}
          <header className="mb-6 space-y-2 text-center">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/5 mb-4 border border-white/5 ring-1 ring-white/10 shadow-lg">
              <Sparkles className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/60">
                TaskMaster
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              Productivity reimagined.
            </p>
          </header>

          {/* Stats Bar */}
          {!loading && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-bold text-white">
                  {stats.total}
                </div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-bold text-blue-400">
                  {stats.active}
                </div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-bold text-green-400">
                  {stats.completed}
                </div>
                <div className="text-xs text-muted-foreground">Done</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <div className="text-2xl font-bold text-red-400">
                  {stats.overdue}
                </div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
            </div>
          )}

          {/* Search & Filters */}
          <div className="mb-6 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all",
                  showFilters || activeFiltersCount > 0
                    ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                )}
              >
                <Filter className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <span className="bg-violet-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add Task</span>
              </button>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <div className="flex flex-wrap gap-2 p-4 bg-white/5 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <select
                  value={filterCategory}
                  onChange={(e) =>
                    setFilterCategory(e.target.value as Category | "all")
                  }
                  className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) =>
                    setFilterPriority(e.target.value as Priority | "all")
                  }
                  className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) =>
                    setFilterStatus(
                      e.target.value as "all" | "active" | "completed"
                    )
                  }
                  className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={() => {
                      setFilterCategory("all")
                      setFilterPriority("all")
                      setFilterStatus("all")
                      setSearchQuery("")
                    }}
                    className="text-sm text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Add Task Form */}
            {showForm && (
              <form
                onSubmit={addTodo}
                className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
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
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-lg border border-white/10 text-muted-foreground hover:bg-white/5 transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Todo List */}
          <div className="space-y-2 mb-6 min-h-[200px] max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4 py-12 text-muted-foreground/50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-medium uppercase tracking-widest">
                  Loading Tasks...
                </p>
              </div>
            ) : todos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                <p className="text-muted-foreground">
                  {activeFiltersCount > 0
                    ? "No tasks match your filters."
                    : "No tasks yet. Add one above!"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={cn(
                      "group relative flex items-start gap-3 p-4 rounded-xl border transition-all duration-200",
                      isOverdue(todo)
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={cn(
                        "flex-shrink-0 mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-300",
                        todo.done
                          ? "bg-green-500 border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                          : "border-muted-foreground hover:border-white"
                      )}
                    >
                      {todo.done && (
                        <Check className="w-3 h-3 text-white" strokeWidth={4} />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {editingId === todo.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && saveEdit(todo.id)
                            }
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(todo.id)}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-muted-foreground hover:text-white text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div
                            onClick={() => startEdit(todo)}
                            className={cn(
                              "text-sm font-medium cursor-pointer transition-colors",
                              todo.done
                                ? "text-muted-foreground line-through decoration-white/20"
                                : "text-foreground hover:text-violet-300"
                            )}
                          >
                            {todo.text}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {/* Category Badge */}
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: `${getCategoryColor(
                                  todo.category
                                )}20`,
                                color: getCategoryColor(todo.category),
                              }}
                            >
                              <Tag className="w-3 h-3" />
                              {categories.find((c) => c.id === todo.category)
                                ?.label || todo.category}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                                priorityConfig[todo.priority].bg,
                                priorityConfig[todo.priority].color
                              )}
                            >
                              {priorityConfig[todo.priority].label}
                            </span>

                            {/* Due Date */}
                            {todo.dueDate && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs",
                                  isOverdue(todo)
                                    ? "text-red-400"
                                    : "text-muted-foreground"
                                )}
                              >
                                {isOverdue(todo) ? (
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

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <select
                        value={todo.priority}
                        onChange={(e) =>
                          updateTodoPriority(
                            todo.id,
                            e.target.value as Priority
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white/10 border-0 rounded text-xs py-1 px-1 focus:outline-none focus:ring-1 focus:ring-violet-500/50 cursor-pointer"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Med</option>
                        <option value="high">High</option>
                      </select>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keyboard Shortcut Hint */}
          <div className="text-center text-xs text-muted-foreground/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to save edits
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex gap-2 text-[10px] text-muted-foreground font-mono bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span>v3.0.0-beta</span>
            <span className="text-white/20">•</span>
            <span>Turbo-Pack</span>
            <span className="text-white/20">•</span>
            <span className="text-green-400">● Online</span>
          </div>
        </div>
      </div>
    </main>
  )
}
