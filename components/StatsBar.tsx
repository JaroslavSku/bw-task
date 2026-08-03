"use client"

import { memo } from "react"
import type { TodoStats } from "@/lib/types"

interface StatsBarProps {
  stats: TodoStats
}

export const StatsBar = memo(function StatsBar({ stats }: StatsBarProps) {
  const tiles = [
    { label: "Total", value: stats.total, color: "text-white" },
    { label: "Active", value: stats.active, color: "text-blue-400" },
    { label: "Done", value: stats.completed, color: "text-green-400" },
    { label: "Overdue", value: stats.overdue, color: "text-red-400" },
  ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="bg-white/5 rounded-xl p-3 text-center border border-white/5"
        >
          <div className={`text-2xl font-bold ${tile.color}`}>{tile.value}</div>
          <div className="text-xs text-muted-foreground">{tile.label}</div>
        </div>
      ))}
    </div>
  )
})
