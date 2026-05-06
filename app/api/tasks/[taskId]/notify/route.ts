import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import {
  requireAdminRequest,
  requireNonEmptyTaskId,
} from "@/lib/backend/route-helpers";
import { getTaskById, notifyTaskCreated } from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

type NotifyRouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: NextRequest, context: NotifyRouteContext) {
  try {
    requireAdminRequest(request);

    const { taskId } = await context.params;
    const id = requireNonEmptyTaskId(taskId);
    const task = await getTaskById(id, false);

    if (!task) {
      throw new HttpError(404, "Task nicht gefunden", "task_not_found");
    }

    const notification = await notifyTaskCreated(task);

    return Response.json({ notification });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
