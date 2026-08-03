"use client"

import { LogOut, Sparkles, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { AddTodoForm, type NewTodoInput } from "@/components/AddTodoForm"
import { FilterBar, type CategoryFilter, type PriorityFilter, type StatusFilter } from "@/components/FilterBar"
import { StatsBar } from "@/components/StatsBar"
import { TodoList, type LoadState } from "@/components/TodoList"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { CategoryInfo } from "@/lib/categories"
import type { Priority, Todo } from "@/lib/schemas/todo"
import type { TodoStats, TodosResponse } from "@/lib/types"

const emptyStats: TodoStats = { total: 0, completed: 0, active: 0, overdue: 0 }
const jsonHeaders = { "Content-Type": "application/json" }

export default function Home() {
  const router = useRouter()

  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [stats, setStats] = useState<TodoStats>(emptyStats)
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })
  const [actionError, setActionError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("all")
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>("all")
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all")
  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  const [refreshCounter, setRefreshCounter] = useState(0)

  const todosRef = useRef<Todo[]>([])
  const statsRef = useRef<TodoStats>(emptyStats)

  useEffect(() => {
    todosRef.current = todos
  }, [todos])

  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  useEffect(() => {
    if (!actionError) return
    const timer = setTimeout(() => setActionError(null), 5000)
    return () => clearTimeout(timer)
  }, [actionError])

  useEffect(() => {
    const controller = new AbortController()

    const params = new URLSearchParams()
    if (filterCategory !== "all") params.set("category", filterCategory)
    if (filterPriority !== "all") params.set("priority", filterPriority)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())

    fetch(`/api/todos?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          router.push("/login")
          return
        }
        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`)
        }
        const data: TodosResponse = await response.json()
        setTodos(data.todos)
        setCategories(data.categories)
        setStats(data.stats)
        setLoadState({ status: "ready" })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadState({ status: "error", message: "Could not load tasks. Please try again." })
        }
      })

    return () => controller.abort()
  }, [filterCategory, filterPriority, filterStatus, debouncedSearch, refreshCounter, router])

  const requestRefresh = useCallback(() => {
    setRefreshCounter((current) => current + 1)
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/todos/stream")
    source.addEventListener("todos", requestRefresh)
    return () => source.close()
  }, [requestRefresh])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { email: string } | null) => {
        if (data) setUserEmail(data.email)
      })
      .catch(() => undefined)
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
    }
  }, [router])

  const addTodo = useCallback(async (input: NewTodoInput) => {
    const previousTodos = todosRef.current
    const previousStats = statsRef.current
    const temporaryId = -Date.now()
    const optimisticTodo: Todo = {
      id: temporaryId,
      text: input.text,
      done: false,
      priority: input.priority,
      category: input.category,
      dueDate: input.dueDate,
      createdAt: new Date().toISOString(),
    }

    setTodos((current) => [optimisticTodo, ...current])
    setStats((current) => ({ ...current, total: current.total + 1, active: current.active + 1 }))
    setShowForm(false)

    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(input),
      })
      if (!response.ok) throw new Error("create failed")
      const createdTodo: Todo = await response.json()
      setTodos((current) => current.map((todo) => (todo.id === temporaryId ? createdTodo : todo)))
    } catch {
      setTodos(previousTodos)
      setStats(previousStats)
      setActionError("Failed to add the task.")
    }
  }, [])

  const toggleTodo = useCallback(async (todoId: number, nextDone: boolean) => {
    const previousTodos = todosRef.current
    const previousStats = statsRef.current

    setTodos((current) =>
      current.map((todo) =>
        todo.id === todoId
          ? { ...todo, done: nextDone, completedAt: nextDone ? new Date().toISOString() : undefined }
          : todo,
      ),
    )
    setStats((current) => ({
      ...current,
      completed: nextDone ? current.completed + 1 : current.completed - 1,
      active: nextDone ? current.active - 1 : current.active + 1,
    }))

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ done: nextDone }),
      })
      if (!response.ok) throw new Error("update failed")
    } catch {
      setTodos(previousTodos)
      setStats(previousStats)
      setActionError("Failed to update the task.")
    }
  }, [])

  const deleteTodo = useCallback(async (todoId: number) => {
    const previousTodos = todosRef.current
    const previousStats = statsRef.current
    const removedTodo = previousTodos.find((todo) => todo.id === todoId)

    setTodos((current) => current.filter((todo) => todo.id !== todoId))
    if (removedTodo) {
      setStats((current) => ({
        ...current,
        total: current.total - 1,
        completed: removedTodo.done ? current.completed - 1 : current.completed,
        active: removedTodo.done ? current.active : current.active - 1,
      }))
    }

    try {
      const response = await fetch(`/api/todos/${todoId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("delete failed")
    } catch {
      setTodos(previousTodos)
      setStats(previousStats)
      setActionError("Failed to delete the task.")
    }
  }, [])

  const saveTodoText = useCallback(async (todoId: number, text: string) => {
    const previousTodos = todosRef.current

    setTodos((current) =>
      current.map((todo) => (todo.id === todoId ? { ...todo, text } : todo)),
    )

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error("update failed")
    } catch {
      setTodos(previousTodos)
      setActionError("Failed to rename the task.")
    }
  }, [])

  const changeTodoPriority = useCallback(async (todoId: number, priority: Priority) => {
    const previousTodos = todosRef.current

    setTodos((current) =>
      current.map((todo) => (todo.id === todoId ? { ...todo, priority } : todo)),
    )

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ priority }),
      })
      if (!response.ok) throw new Error("update failed")
    } catch {
      setTodos(previousTodos)
      setActionError("Failed to change the priority.")
    }
  }, [])

  const clearFilters = useCallback(() => {
    setFilterCategory("all")
    setFilterPriority("all")
    setFilterStatus("all")
    setSearchQuery("")
  }, [])

  const toggleFilters = useCallback(() => setShowFilters((current) => !current), [])
  const toggleForm = useCallback(() => setShowForm((current) => !current), [])
  const hideForm = useCallback(() => setShowForm(false), [])
  const retryFetch = useCallback(() => {
    setLoadState({ status: "loading" })
    setRefreshCounter((current) => current + 1)
  }, [])

  const activeFiltersCount = [
    filterCategory !== "all",
    filterPriority !== "all",
    filterStatus !== "all",
    searchQuery !== "",
  ].filter(Boolean).length

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="glass-card rounded-2xl p-8">
          <header className="mb-6 space-y-2 text-center relative">
            <button
              onClick={logout}
              title={userEmail ? `Sign out (${userEmail})` : "Sign out"}
              className="absolute right-0 top-0 p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
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

          {actionError && (
            <div className="mb-4 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 animate-in fade-in duration-200">
              <span>{actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {loadState.status === "ready" && <StatsBar stats={stats} />}

          <div className="mb-6 space-y-3">
            <FilterBar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              filterCategory={filterCategory}
              onFilterCategoryChange={setFilterCategory}
              filterPriority={filterPriority}
              onFilterPriorityChange={setFilterPriority}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
              categories={categories}
              showFilters={showFilters}
              onToggleFilters={toggleFilters}
              onToggleForm={toggleForm}
              activeFiltersCount={activeFiltersCount}
              onClearFilters={clearFilters}
            />

            {showForm && (
              <AddTodoForm
                categories={categories}
                onSubmit={addTodo}
                onCancel={hideForm}
              />
            )}
          </div>

          <div className="space-y-2 mb-6 min-h-[200px] max-h-[400px] overflow-y-auto">
            <TodoList
              todos={todos}
              categories={categories}
              loadState={loadState}
              hasActiveFilters={activeFiltersCount > 0}
              onRetry={retryFetch}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onSaveText={saveTodoText}
              onChangePriority={changeTodoPriority}
            />
          </div>

          <div className="text-center text-xs text-muted-foreground/50">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to save edits
          </div>
        </div>

        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex gap-2 text-[10px] text-muted-foreground font-mono bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span>v3.0.0</span>
            <span className="text-white/20">•</span>
            <span>{userEmail ?? "..."}</span>
            <span className="text-white/20">•</span>
            <span className="text-green-400">● Online</span>
          </div>
        </div>
      </div>
    </main>
  )
}
