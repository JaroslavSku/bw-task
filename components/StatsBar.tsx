"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { StatusFilter } from "@/components/FilterBar"
import type { TodoStats } from "@/lib/types"

interface StatsBarProps {
  stats: TodoStats
  filterStatus: StatusFilter
  onFilterStatusChange: (value: StatusFilter) => void
}

export const StatsBar = memo(function StatsBar({
  stats,
  filterStatus,
  onFilterStatusChange,
}: StatsBarProps) {
  const tiles = [
    { label: "Total", status: "all", value: stats.total, color: "text-white" },
    {
      label: "Active",
      status: "active",
      value: stats.active,
      color: "text-blue-400",
    },
    {
      label: "Done",
      status: "completed",
      value: stats.completed,
      color: "text-green-400",
    },
    {
      label: "Overdue",
      status: "overdue",
      value: stats.overdue,
      color: "text-red-400",
    },
  ] as const

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {tiles.map((tile) => (
        <button
          key={tile.label}
          onClick={() =>
            onFilterStatusChange(
              filterStatus === tile.status ? "all" : tile.status,
            )
          }
          aria-pressed={filterStatus === tile.status}
          className={cn(
            "rounded-xl p-3 text-center border transition-all hover:bg-white/10",
            filterStatus === tile.status
              ? "bg-white/10 border-violet-500/50"
              : "bg-white/5 border-white/5",
          )}
        >
          <div className={`text-2xl font-bold ${tile.color}`}>{tile.value}</div>
          <div className="text-xs text-muted-foreground">{tile.label}</div>
        </button>
      ))}
    </div>
  )
})
