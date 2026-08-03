import type { Category } from "@/lib/schemas/todo";

export interface CategoryInfo {
    id: Category;
    label: string;
    color: string;
}

export const categories: CategoryInfo[] = [
    { id: "personal", label: "Personal", color: "#8b5cf6" },
    { id: "work", label: "Work", color: "#3b82f6" },
    { id: "shopping", label: "Shopping", color: "#10b981" },
    { id: "health", label: "Health", color: "#ef4444" },
    { id: "other", label: "Other", color: "#6b7280" },
];
