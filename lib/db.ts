export type Priority = "low" | "medium" | "high";
export type Category = "personal" | "work" | "shopping" | "health" | "other";

export interface Todo {
    id: number;
    text: string;
    done: boolean;
    priority: Priority;
    category: Category;
    dueDate?: string;
    createdAt: string;
    completedAt?: string;
}

export const categories: { id: Category; label: string; color: string }[] = [
    { id: "personal", label: "Personal", color: "#8b5cf6" },
    { id: "work", label: "Work", color: "#3b82f6" },
    { id: "shopping", label: "Shopping", color: "#10b981" },
    { id: "health", label: "Health", color: "#ef4444" },
    { id: "other", label: "Other", color: "#6b7280" },
];

export const todos: Todo[] = [
    { 
        id: 1, 
        text: "Complete project proposal", 
        done: false, 
        priority: "high", 
        category: "work",
        dueDate: "2026-01-10",
        createdAt: "2026-01-05T10:00:00Z"
    },
    { 
        id: 2, 
        text: "Buy groceries", 
        done: true, 
        priority: "medium", 
        category: "shopping",
        createdAt: "2026-01-04T08:00:00Z",
        completedAt: "2026-01-04T14:30:00Z"
    },
    { 
        id: 3, 
        text: "Schedule dentist appointment", 
        done: false, 
        priority: "low", 
        category: "health",
        dueDate: "2026-01-15",
        createdAt: "2026-01-03T09:00:00Z"
    },
    { 
        id: 4, 
        text: "Review pull requests", 
        done: false, 
        priority: "high", 
        category: "work",
        dueDate: "2026-01-08",
        createdAt: "2026-01-06T11:00:00Z"
    },
    { 
        id: 5, 
        text: "Call mom", 
        done: false, 
        priority: "medium", 
        category: "personal",
        createdAt: "2026-01-06T12:00:00Z"
    },
];
