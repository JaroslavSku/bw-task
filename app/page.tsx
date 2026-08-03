"use client"

import { LogOut, Sparkles, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { AddTodoForm, type NewTodoInput } from "@/components/AddTodoForm"
import {
  FilterBar,
  type CategoryFilter,
  type PriorityFilter,
  type StatusFilter,
} from "@/components/FilterBar"
import { StatsBar } from "@/components/StatsBar"
import { TodoList, type LoadState } from "@/components/TodoList"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import type { CategoryInfo } from "@/lib/categories"
import type { Priority, Todo } from "@/lib/schemas/todo"
import type { TodoStats, TodosResponse } from "@/lib/types"

const emptyStats: TodoStats = { total: 0, completed: 0, active: 0, overdue: 0 }
const jsonHeaders = { "Content-Type": "application/json" }

const streamStatus = {
  connecting: { label: "Connecting", className: "text-amber-400" },
  online: { label: "Online", className: "text-green-400" },
  offline: { label: "Offline", className: "text-red-400" },
}

type StreamState = keyof typeof streamStatus

export default function Home() {
  const router = useRouter()

  const [todos, setTodos] = useState<Todo[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [stats, setStats] = useState<TodoStats>(emptyStats)
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })
  const [actionError, setActionError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [streamState, setStreamState] = useState<StreamState>("connecting")

  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>("all")
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>("all")
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all")
  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  const [refreshCounter, setRefreshCounter] = useState(0)
  const debouncedRefreshCounter = useDebouncedValue(refreshCounter, 150)

  const todosRef = useRef<Todo[]>([])

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

    const loadTodos = async () => {
      try {
        const response = await fetch(`/api/todos?${params}`, {
          signal: controller.signal,
        })
        if (response.status === 401) {
          router.push("/login")
          return
        }
        if (!response.ok) {
          throw new Error(`request failed with status ${response.status}`)
        }
        const data: TodosResponse = await response.json()
        setTodos(data.todos)
        todosRef.current = data.todos
        setCategories(data.categories)
        setStats(data.stats)
        setLoadState({ status: "ready" })
      } catch {
        if (!controller.signal.aborted) {
          setLoadState({
            status: "error",
            message: "Could not load tasks. Please try again.",
          })
        }
      }
    }

    void loadTodos()

    return () => controller.abort()
  }, [
    filterCategory,
    filterPriority,
    filterStatus,
    debouncedSearch,
    debouncedRefreshCounter,
    router,
  ])

  const requestRefresh = useCallback(() => {
    setRefreshCounter((current) => current + 1)
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/todos/stream")
    let connectedBefore = false

    source.addEventListener("open", () => {
      setStreamState("online")
      if (connectedBefore) {
        requestRefresh()
      }
      connectedBefore = true
    })
    source.addEventListener("todos", requestRefresh)
    source.addEventListener("error", () => {
      if (source.readyState === EventSource.CLOSED) {
        setStreamState("offline")
        requestRefresh()
        return
      }
      setStreamState("connecting")
    })

    return () => source.close()
  }, [requestRefresh])

  useEffect(() => {
    const loadUserEmail = async () => {
      try {
        const response = await fetch("/api/auth/me")
        if (!response.ok) {
          return
        }
        const data: { email: string } = await response.json()
        setUserEmail(data.email)
      } catch {
        return
      }
    }

    void loadUserEmail()
  }, [])

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/login")
    }
  }

  const runTodoAction = useCallback(
    async (
      applyOptimistic: (todos: Todo[]) => Todo[],
      performRequest: () => Promise<Response>,
      errorMessage: string,
    ) => {
      const previousTodos = todosRef.current
      const optimisticTodos = applyOptimistic(previousTodos)
      todosRef.current = optimisticTodos
      setTodos(optimisticTodos)

      try {
        const response = await performRequest()
        if (!response.ok) throw new Error(errorMessage)
        requestRefresh()
      } catch {
        todosRef.current = previousTodos
        setTodos(previousTodos)
        setActionError(errorMessage)
      }
    },
    [requestRefresh],
  )

  const addTodo = useCallback(
    (input: NewTodoInput) => {
      setShowForm(false)
      const optimisticTodo: Todo = {
        id: -Date.now(),
        text: input.text,
        done: false,
        priority: input.priority,
        category: input.category,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
      }
      runTodoAction(
        (todos) => [optimisticTodo, ...todos],
        () =>
          fetch("/api/todos", {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify(input),
          }),
        "Failed to add the task.",
      )
    },
    [runTodoAction],
  )

  const patchTodo = useCallback(
    (todoId: number, patch: Partial<Todo>, errorMessage: string) => {
      runTodoAction(
        (todos) =>
          todos.map((todo) =>
            todo.id === todoId ? { ...todo, ...patch } : todo,
          ),
        () =>
          fetch(`/api/todos/${todoId}`, {
            method: "PATCH",
            headers: jsonHeaders,
            body: JSON.stringify(patch),
          }),
        errorMessage,
      )
    },
    [runTodoAction],
  )

  const toggleTodo = useCallback(
    (todoId: number, nextDone: boolean) => {
      patchTodo(todoId, { done: nextDone }, "Failed to update the task.")
    },
    [patchTodo],
  )

  const saveTodoText = useCallback(
    (todoId: number, text: string) => {
      patchTodo(todoId, { text }, "Failed to rename the task.")
    },
    [patchTodo],
  )

  const changeTodoPriority = useCallback(
    (todoId: number, priority: Priority) => {
      patchTodo(todoId, { priority }, "Failed to change the priority.")
    },
    [patchTodo],
  )

  const deleteTodo = useCallback(
    (todoId: number) => {
      runTodoAction(
        (todos) => todos.filter((todo) => todo.id !== todoId),
        () => fetch(`/api/todos/${todoId}`, { method: "DELETE" }),
        "Failed to delete the task.",
      )
    },
    [runTodoAction],
  )

  const clearFilters = useCallback(() => {
    setFilterCategory("all")
    setFilterPriority("all")
    setFilterStatus("all")
    setSearchQuery("")
  }, [])

  const toggleFilters = useCallback(
    () => setShowFilters((current) => !current),
    [],
  )
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

          {loadState.status === "ready" && (
            <StatsBar
              stats={stats}
              filterStatus={filterStatus}
              onFilterStatusChange={setFilterStatus}
            />
          )}

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
            <span className={streamStatus[streamState].className}>
              ● {streamStatus[streamState].label}
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
