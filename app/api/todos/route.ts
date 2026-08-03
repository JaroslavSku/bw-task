import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { categories } from "@/lib/categories";
import { handleRoute, jsonError, readJsonBody, validationError } from "@/lib/http";
import { createTodo, getTodoStats, listTodos } from "@/lib/repositories/todos";
import { createTodoSchema, todoFiltersSchema } from "@/lib/schemas/todo";

export function GET(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            return jsonError(401, "unauthorized");
        }

        const { searchParams } = new URL(request.url);
        const parsedFilters = todoFiltersSchema.safeParse({
            category: searchParams.get("category") ?? undefined,
            priority: searchParams.get("priority") ?? undefined,
            status: searchParams.get("status") ?? undefined,
            search: searchParams.get("search") || undefined,
            limit: searchParams.get("limit") ?? undefined,
            offset: searchParams.get("offset") ?? undefined,
        });
        if (!parsedFilters.success) {
            return validationError(parsedFilters.error);
        }

        const [todos, stats] = await Promise.all([
            listTodos(userId, parsedFilters.data),
            getTodoStats(userId),
        ]);

        return NextResponse.json({ todos, categories, stats });
    });
}

export function POST(request: Request): Promise<Response> {
    return handleRoute(async () => {
        const userId = await getCurrentUserId();
        if (!userId) {
            return jsonError(401, "unauthorized");
        }

        const body = await readJsonBody(request);
        if (body === null) {
            return jsonError(400, "invalid json body");
        }

        const parsedInput = createTodoSchema.safeParse(body);
        if (!parsedInput.success) {
            return validationError(parsedInput.error);
        }

        const createdTodo = await createTodo(userId, parsedInput.data);
        return NextResponse.json(createdTodo, { status: 201 });
    });
}
