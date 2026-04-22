import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import {
  isAdminRequest,
  readJsonBody,
  requireAdminRequest,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import {
  deleteTask,
  getTaskById,
  parseUpdateTaskInput,
  updateTask,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type TaskRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: NextRequest, context: TaskRouteContext) {
  try {
    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const isAdmin = isAdminRequest(request);
    const task = await getTaskById(id, isAdmin);

    if (!task || (!isAdmin && task.isHidden)) {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    return Response.json({ task, isAdmin });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: TaskRouteContext) {
  try {
    requireAdminRequest(request);

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const body = await readJsonBody(request);
    const input = parseUpdateTaskInput(body);
    const task = await updateTask(id, input);

    return Response.json({ task });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: TaskRouteContext) {
  try {
    requireAdminRequest(request);

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    await deleteTask(id);

    return Response.json({ ok: true });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
