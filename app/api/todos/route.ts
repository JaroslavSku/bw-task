import { todos, Todo, categories } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const priority = searchParams.get("priority");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let filtered = [...todos];

    if (category && category !== "all") {
        filtered = filtered.filter(todo => todo.category === category);
    }

    if (priority && priority !== "all") {
        filtered = filtered.filter(todo => todo.priority === priority);
    }

    if (status === "completed") {
        filtered = filtered.filter(todo => todo.done);
    } else if (status === "active") {
        filtered = filtered.filter(todo => !todo.done);
    }

    if (search) {
        filtered = filtered.filter(todo =>
            todo.text.toLowerCase().includes(search.toLowerCase())
        );
    }

    return NextResponse.json({
        todos: filtered,
        categories,
        stats: {
            total: todos.length,
            completed: todos.filter(todo => todo.done).length,
            active: todos.filter(todo => !todo.done).length,
            overdue: todos.filter(todo => !todo.done && todo.dueDate && new Date(todo.dueDate) < new Date()).length,
        }
    });
}

export async function POST(request: Request) {
    const body = await request.json();

    const newTodo: Todo = {
        id: Date.now(),
        text: body.text,
        done: false,
        priority: body.priority || "medium",
        category: body.category || "other",
        dueDate: body.dueDate,
        createdAt: new Date().toISOString(),
    };

    todos.push(newTodo);
    return NextResponse.json(newTodo);
}

export async function PUT(request: Request) {
    const body = await request.json();

    const todo = todos.find(existing => existing.id === body.id);
    if (todo) {
        if (body.text !== undefined) todo.text = body.text;
        if (body.priority !== undefined) todo.priority = body.priority;
        if (body.category !== undefined) todo.category = body.category;
        if (body.dueDate !== undefined) todo.dueDate = body.dueDate;
        if (body.done !== undefined) {
            todo.done = body.done;
            todo.completedAt = body.done ? new Date().toISOString() : undefined;
        }
        if (body.toggleDone) {
            todo.done = !todo.done;
            todo.completedAt = todo.done ? new Date().toISOString() : undefined;
        }
    }
    return NextResponse.json(todo || {});
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    const index = todos.findIndex((todo) => todo.id === id);
    if (index > -1) {
        todos.splice(index, 1);
    }

    return NextResponse.json({ success: true });
}
