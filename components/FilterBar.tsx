"use client"

import { Filter, Plus, Search, X } from "lucide-react"
import { memo } from "react"
import { cn } from "@/lib/utils"
import type { CategoryInfo } from "@/lib/categories"
import type { Category, Priority } from "@/lib/schemas/todo"

export type CategoryFilter = Category | "all"
export type PriorityFilter = Priority | "all"
export type StatusFilter = "all" | "active" | "completed"

interface FilterBarProps {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  filterCategory: CategoryFilter
  onFilterCategoryChange: (value: CategoryFilter) => void
  filterPriority: PriorityFilter
  onFilterPriorityChange: (value: PriorityFilter) => void
  filterStatus: StatusFilter
  onFilterStatusChange: (value: StatusFilter) => void
  categories: CategoryInfo[]
  showFilters: boolean
  onToggleFilters: () => void
  onToggleForm: () => void
  activeFiltersCount: number
  onClearFilters: () => void
}

export const FilterBar = memo(function FilterBar({
  searchQuery,
  onSearchQueryChange,
  filterCategory,
  onFilterCategoryChange,
  filterPriority,
  onFilterPriorityChange,
  filterStatus,
  onFilterStatusChange,
  categories,
  showFilters,
  onToggleFilters,
  onToggleForm,
  activeFiltersCount,
  onClearFilters,
}: FilterBarProps) {
  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
          />
        </div>
        <button
          onClick={onToggleFilters}
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
          onClick={onToggleForm}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Task</span>
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 bg-white/5 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
          <select
            value={filterCategory}
            onChange={(event) => onFilterCategoryChange(event.target.value as CategoryFilter)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="all">All Categories</option>
            {categories.map((categoryInfo) => (
              <option key={categoryInfo.id} value={categoryInfo.id}>
                {categoryInfo.label}
              </option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(event) => onFilterPriorityChange(event.target.value as PriorityFilter)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterStatus}
            onChange={(event) => onFilterStatusChange(event.target.value as StatusFilter)}
            className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="text-sm text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </>
  )
})
