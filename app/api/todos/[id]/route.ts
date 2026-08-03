import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/auth/currentUser"
import {
  handleRoute,
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/http"
import { deleteTodo, updateTodo } from "@/lib/repositories/todos"
import { todoIdSchema, updateTodoSchema } from "@/lib/schemas/todo"

interface RouteContext {
  params: Promise<{ id: string }>
}

export function PATCH(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return handleRoute(async () => {
    const userId = await getCurrentUserId()
    if (!userId) {
      return jsonError(401, "unauthorized")
    }

    const { id } = await context.params
    const parsedId = todoIdSchema.safeParse(id)
    if (!parsedId.success) {
      return jsonError(400, "invalid todo id")
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return jsonError(400, "invalid json body")
    }

    const parsedPatch = updateTodoSchema.safeParse(body)
    if (!parsedPatch.success) {
      return validationError(parsedPatch.error)
    }

    const updatedTodo = await updateTodo(
      userId,
      parsedId.data,
      parsedPatch.data,
    )
    if (!updatedTodo) {
      return jsonError(404, "todo not found")
    }
    return NextResponse.json(updatedTodo)
  })
}

export function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  return handleRoute(async () => {
    const userId = await getCurrentUserId()
    if (!userId) {
      return jsonError(401, "unauthorized")
    }

    const { id } = await context.params
    const parsedId = todoIdSchema.safeParse(id)
    if (!parsedId.success) {
      return jsonError(400, "invalid todo id")
    }

    const deleted = await deleteTodo(userId, parsedId.data)
    if (!deleted) {
      return jsonError(404, "todo not found")
    }
    return new NextResponse(null, { status: 204 })
  })
}
